import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightAddon,
  Select,
  SimpleGrid,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { ChefHat, PackageOpen, PackagePlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  doseToBaseQty,
  expiryStatus,
  formatQty,
  formatUnitCost,
  suggestParLevel,
  usableYield,
} from '@digita/core';
import {
  REASON_LABEL,
  WASTE_KIND_LABEL,
  formatDate,
  formatDateTime,
  formatPesos,
  formatStock,
  isoDate,
  plural,
  type StockRow,
} from '../../lib/inventory';
import { useCatalogStore } from '../../store/catalogStore';
import { useInventoryStore } from '../../store/inventoryStore';
import { useStockRows } from '../../store/selectors';
import { ExpiryBadge, StockStatusBadge } from './StatusBadges';
import type { WastePreset } from './WasteModal';

interface ItemDrawerProps {
  itemId: string | null;
  onClose: () => void;
  onReceive: (itemId: string) => void;
  onWaste: (preset: WastePreset) => void;
}

const COST_SOURCE_LABEL: Record<StockRow['costSource'], string> = {
  batch: 'from stock on hand',
  last_batch: 'last delivery',
  standard: 'price list',
  recipe: 'from recipe',
  none: 'no cost',
};

export function ItemDrawer({ itemId, onClose, onReceive, onWaste }: ItemDrawerProps) {
  const rows = useStockRows();
  const row = rows.find((r) => r.item.id === itemId);
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const tileBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.50');

  return (
    <Drawer isOpen={Boolean(row)} onClose={onClose} size="lg">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        {row && (
          <>
            <DrawerHeader pb={2}>
              <Flex align="center" gap={2} pr={8}>
                <Text>{row.item.name}</Text>
                <StockStatusBadge row={row} />
              </Flex>
              <Text fontSize="sm" fontWeight="400" color={muted}>
                {row.item.category} ·{' '}
                {row.item.itemType === 'sub_assembly'
                  ? `prep item, ${formatQty(row.item.prepYieldQty ?? 0, row.item.baseUnit)} per batch`
                  : `${plural(row.item.purchaseUnit, 1)} of ${formatQty(row.item.packSize, row.item.baseUnit)}`}
              </Text>
              <HStack mt={3} spacing={2}>
                {row.item.itemType !== 'sub_assembly' && (
                  <Button size="sm" leftIcon={<PackagePlus size={14} />} onClick={() => onReceive(row.item.id)}>
                    Receive
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Trash2 size={14} />}
                  isDisabled={row.onHand <= 0}
                  onClick={() => onWaste({ itemId: row.item.id })}
                >
                  Log waste
                </Button>
              </HStack>
            </DrawerHeader>
            <DrawerBody>
              <SimpleGrid columns={2} spacing={2} mb={5}>
                <Tile label="On hand" bg={tileBg}>
                  {row.status === 'untracked' ? 'Not counted' : formatStock(row.onHand, row.item)}
                </Tile>
                <Tile label="Value" bg={tileBg}>
                  {formatPesos(row.value)}
                </Tile>
                <Tile label={`Unit cost · ${COST_SOURCE_LABEL[row.costSource]}`} bg={tileBg}>
                  {row.unitCost !== undefined ? formatUnitCost(row.unitCost, row.item.baseUnit) : '—'}
                </Tile>
                <Tile label="Measured use" bg={tileBg}>
                  {row.velocity.perDay > 0
                    ? `${formatQty(row.velocity.perDay, row.item.baseUnit)}/day`
                    : 'None recorded'}
                  <Text as="span" fontSize="xs" fontWeight="400" color={muted}>
                    {row.velocity.perDay > 0 &&
                      ` · ${Number.isFinite(row.cover) ? `${Math.floor(row.cover)} days cover` : ''}`}
                  </Text>
                </Tile>
              </SimpleGrid>

              {row.item.itemType === 'sub_assembly' && <PrepRunPanel row={row} />}

              <Tabs size="sm" colorScheme="orange" isLazy>
                <TabList>
                  <Tab>Batches</Tab>
                  <Tab>History</Tab>
                  <Tab>Settings</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel px={0}>
                    <BatchesTab row={row} onWaste={onWaste} />
                  </TabPanel>
                  <TabPanel px={0}>
                    <HistoryTab row={row} />
                  </TabPanel>
                  <TabPanel px={0}>
                    <SettingsTab row={row} />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function Tile({ label, bg, children }: { label: string; bg: string; children: React.ReactNode }) {
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  return (
    <Box bg={bg} borderRadius="8px" px={3} py={2}>
      <Text fontSize="10px" fontWeight="700" letterSpacing="0.05em" color={muted}>
        {label.toUpperCase()}
      </Text>
      <Text className="numeric" fontWeight="600">
        {children}
      </Text>
    </Box>
  );
}

function BatchesTab({ row, onWaste }: { row: StockRow; onWaste: (preset: WastePreset) => void }) {
  const openBatch = useInventoryStore((s) => s.openBatch);
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');

  if (row.live.length === 0) {
    return (
      <Text fontSize="sm" color={muted}>
        No stock on hand. Batches appear here when a delivery is received, a prep batch is made, or
        a count finds stock.
      </Text>
    );
  }

  const hasOpen = row.live.some((b) => b.isOpen);

  return (
    <Box overflowX="auto">
      <Text fontSize="xs" color={muted} mb={3}>
        In the order they will be used: the open container first, then soonest expiry.
      </Text>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Received</Th>
            <Th>Expiry</Th>
            <Th isNumeric>Left</Th>
            <Th isNumeric>Cost</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          {row.live.map((b) => (
            <Tr key={b.id}>
              <Td fontSize="xs">
                {formatDate(b.receivedAt)}
                {b.isOpen && (
                  <Badge ml={2} colorScheme="orange" fontSize="9px">
                    open
                  </Badge>
                )}
              </Td>
              <Td>
                {b.expiryDate ? (
                  <ExpiryBadge date={b.expiryDate} status={expiryStatus(b)} />
                ) : (
                  <Text fontSize="xs" color={muted}>
                    —
                  </Text>
                )}
              </Td>
              <Td className="numeric" isNumeric fontSize="xs">
                {formatQty(b.qtyRemaining, row.item.baseUnit)}
                <Text as="span" color={muted}>
                  {' '}
                  / {formatQty(b.qtyReceived, row.item.baseUnit)}
                </Text>
              </Td>
              <Td className="numeric" isNumeric fontSize="xs">
                {formatUnitCost(b.unitCost, row.item.baseUnit)}
              </Td>
              <Td>
                <HStack spacing={1} justify="flex-end">
                  {!b.isOpen && !hasOpen && (
                    <Button
                      size="xs"
                      variant="ghost"
                      leftIcon={<PackageOpen size={12} />}
                      onClick={() => {
                        try {
                          openBatch(b.id);
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                    >
                      Open
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() =>
                      onWaste({
                        itemId: row.item.id,
                        batchId: b.id,
                        qty: b.qtyRemaining,
                        kind: b.expiryDate && expiryStatus(b) === 'expired' ? 'expired' : 'spoiled',
                      })
                    }
                  >
                    Write off
                  </Button>
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}

function HistoryTab({ row }: { row: StockRow }) {
  const movements = useInventoryStore((s) => s.movements);
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const own = useMemo(
    () => movements.filter((m) => m.itemId === row.item.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [movements, row.item.id],
  );

  if (own.length === 0) {
    return (
      <Text fontSize="sm" color={muted}>
        Nothing recorded yet. Every receipt, sale, write-off and count adjustment will be listed here —
        on hand is always the sum of this ledger.
      </Text>
    );
  }

  return (
    <Box overflowX="auto">
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>When</Th>
            <Th>What</Th>
            <Th isNumeric>Qty</Th>
            <Th isNumeric>Value</Th>
          </Tr>
        </Thead>
        <Tbody>
          {own.map((m) => (
            <Tr key={m.id}>
              <Td fontSize="xs" whiteSpace="nowrap">
                {formatDateTime(m.occurredAt)}
              </Td>
              <Td fontSize="xs">
                {REASON_LABEL[m.reason]}
                {m.wasteKind && (
                  <Text as="span" color={muted}>
                    {' '}
                    · {WASTE_KIND_LABEL[m.wasteKind]}
                  </Text>
                )}
                {m.note && (
                  <Text color={muted} noOfLines={1}>
                    {m.note}
                  </Text>
                )}
              </Td>
              <Td className="numeric" isNumeric fontSize="xs" color={m.qty < 0 ? 'margin.bad' : 'margin.good'}>
                {m.qty > 0 ? '+' : '−'}
                {formatQty(Math.abs(m.qty), row.item.baseUnit)}
              </Td>
              <Td className="numeric" isNumeric fontSize="xs">
                {formatPesos(Math.abs(m.qty * m.costAtTime))}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}

/**
 * Par and reorder point are entered in purchase units — "keep 4 bottles,
 * reorder at 2" — and stored in base units like everything else.
 */
function SettingsTab({ row }: { row: StockRow }) {
  const updateItem = useCatalogStore((s) => s.updateItem);
  const suppliers = useInventoryStore((s) => s.suppliers);
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const { item } = row;
  const unit = item.itemType === 'sub_assembly' ? 1 : item.packSize;
  const unitLabel = item.itemType === 'sub_assembly' ? item.baseUnit : plural(item.purchaseUnit, 2);

  const [supplierId, setSupplierId] = useState(item.supplierId ?? '');
  const [reorderAt, setReorderAt] = useState(String(+(item.reorderPoint / unit).toFixed(2)));
  const [par, setPar] = useState(String(+(item.parLevel / unit).toFixed(2)));
  const [shelfLife, setShelfLife] = useState(item.shelfLifeDays ? String(item.shelfLifeDays) : '');
  const [yieldPct, setYieldPct] = useState(String(+(item.yieldPct * 100).toFixed(1)));
  const [seasonal, setSeasonal] = useState(item.isSeasonal);

  useEffect(() => {
    setSupplierId(item.supplierId ?? '');
    setReorderAt(String(+(item.reorderPoint / unit).toFixed(2)));
    setPar(String(+(item.parLevel / unit).toFixed(2)));
    setShelfLife(item.shelfLifeDays ? String(item.shelfLifeDays) : '');
    setYieldPct(String(+(item.yieldPct * 100).toFixed(1)));
    setSeasonal(item.isSeasonal);
  }, [item, unit]);

  const reorderN = Number(reorderAt) || 0;
  const parN = Number(par) || 0;
  const yieldN = Number(yieldPct);
  const parError = parN < reorderN ? 'Par must be at least the reorder point.' : '';
  const yieldError = !(yieldN > 0 && yieldN <= 100) ? 'Between 1 and 100%.' : '';

  const leadTime = suppliers.find((s) => s.id === supplierId)?.leadTimeDays ?? row.leadTimeDays;
  const suggested =
    row.velocity.perDay > 0
      ? suggestParLevel(row.velocity.perDay, leadTime, 3, Number(shelfLife) || undefined) / unit
      : undefined;

  const save = () => {
    if (parError || yieldError) return;
    updateItem(item.id, {
      supplierId: supplierId || undefined,
      reorderPoint: reorderN * unit,
      parLevel: parN * unit,
      shelfLifeDays: Number(shelfLife) > 0 ? Math.round(Number(shelfLife)) : undefined,
      yieldPct: yieldN / 100,
      isSeasonal: seasonal,
    });
    toast.success(`Saved ${item.name}`);
  };

  return (
    <Flex direction="column" gap={4}>
      {item.itemType !== 'sub_assembly' && (
        <FormControl>
          <FormLabel fontSize="sm">Supplier</FormLabel>
          <Select size="sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.leadTimeDays}-day lead time
              </option>
            ))}
          </Select>
          <FormHelperText fontSize="xs">
            {suppliers.length === 0
              ? 'Add suppliers in Purchasing. Lead time is what turns low stock into "order now".'
              : 'Groups reorder suggestions and sets the lead time for urgency.'}
          </FormHelperText>
        </FormControl>
      )}

      <SimpleGrid columns={2} spacing={3}>
        <FormControl>
          <FormLabel fontSize="sm">Reorder at</FormLabel>
          <InputGroup size="sm">
            <Input className="numeric" type="number" min={0} value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} />
            <InputRightAddon fontSize="xs">{unitLabel}</InputRightAddon>
          </InputGroup>
        </FormControl>
        <FormControl isInvalid={Boolean(parError)}>
          <FormLabel fontSize="sm">Par level</FormLabel>
          <InputGroup size="sm">
            <Input className="numeric" type="number" min={0} value={par} onChange={(e) => setPar(e.target.value)} />
            <InputRightAddon fontSize="xs">{unitLabel}</InputRightAddon>
          </InputGroup>
          <FormErrorMessage fontSize="xs">{parError}</FormErrorMessage>
        </FormControl>
      </SimpleGrid>

      {suggested !== undefined ? (
        <Alert status="info" borderRadius="8px" fontSize="xs" py={2}>
          <AlertIcon />
          <Flex flex="1" align="center" justify="space-between" gap={2}>
            <Text>
              Measured use suggests a par of {+suggested.toFixed(1)} {unitLabel} ({leadTime}-day lead
              time plus 3 days of safety{Number(shelfLife) > 0 ? ', capped by shelf life' : ''}).
            </Text>
            <Button size="xs" variant="outline" onClick={() => setPar(String(Math.ceil(suggested)))}>
              Use {Math.ceil(suggested)}
            </Button>
          </Flex>
        </Alert>
      ) : (
        <Text fontSize="xs" color={muted}>
          A suggested par appears once use has been recorded against this item.
        </Text>
      )}

      <SimpleGrid columns={2} spacing={3}>
        <FormControl>
          <FormLabel fontSize="sm">Shelf life</FormLabel>
          <InputGroup size="sm">
            <Input className="numeric" type="number" min={0} value={shelfLife} onChange={(e) => setShelfLife(e.target.value)} />
            <InputRightAddon fontSize="xs">days</InputRightAddon>
          </InputGroup>
          <FormHelperText fontSize="xs">Pre-fills expiry when receiving.</FormHelperText>
        </FormControl>
        <FormControl isInvalid={Boolean(yieldError)}>
          <FormLabel fontSize="sm">Usable yield</FormLabel>
          <InputGroup size="sm">
            <Input className="numeric" type="number" min={1} max={100} value={yieldPct} onChange={(e) => setYieldPct(e.target.value)} />
            <InputRightAddon fontSize="xs">%</InputRightAddon>
          </InputGroup>
          {yieldError ? (
            <FormErrorMessage fontSize="xs">{yieldError}</FormErrorMessage>
          ) : (
            <FormHelperText fontSize="xs">Grinder retention, purge. Recipes draw qty ÷ yield.</FormHelperText>
          )}
        </FormControl>
      </SimpleGrid>

      <FormControl display="flex" alignItems="center" gap={3}>
        <Switch isChecked={seasonal} onChange={(e) => setSeasonal(e.target.checked)} colorScheme="orange" />
        <FormLabel fontSize="sm" m={0}>
          Seasonal — stocked to plan, not to measured use
        </FormLabel>
      </FormControl>

      <Flex justify="flex-end">
        <Button size="sm" onClick={save} isDisabled={Boolean(parError || yieldError)}>
          Save settings
        </Button>
      </Flex>
    </Flex>
  );
}

/**
 * Making a batch of a prep item consumes its ingredients from stock and
 * produces a batch carrying what they actually cost — so a cheesecake slice is
 * costed against the cake it was cut from.
 */
function PrepRunPanel({ row }: { row: StockRow }) {
  const recipeLines = useCatalogStore((s) => s.recipeLines);
  const runPrep = useInventoryStore((s) => s.runPrep);
  const rows = useStockRows();
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const mutedColor = useColorModeValue('gray.500', 'whiteAlpha.600');
  const { item } = row;

  const [runs, setRuns] = useState('1');
  const [expiry, setExpiry] = useState(item.shelfLifeDays ? isoDate(item.shelfLifeDays) : '');
  const runsN = Number(runs);

  const needs = recipeLines
    .filter((l) => l.ownerId === item.id)
    .map((l) => {
      const ingredient = rows.find((r) => r.item.id === l.itemId);
      const need = ingredient ? (doseToBaseQty(l.dose, []) * (runsN || 0)) / usableYield(ingredient.item.yieldPct) : 0;
      return { ingredient, need, short: ingredient ? need - ingredient.onHand : 0 };
    });
  const shortCount = needs.filter((n) => n.short > 1e-9).length;

  const record = () => {
    try {
      const result = runPrep(item.id, runsN, expiry || undefined);
      toast.success(
        `Made ${formatQty(result.producedQty, item.baseUnit)} of ${item.name} at ${formatUnitCost(result.unitCost, item.baseUnit)}`,
      );
      if (result.shortfalls.length > 0) {
        toast(`${result.shortfalls.length} ingredient(s) weren't on record — costed at the price list. They'll show as variance at the next count.`, {
          icon: '⚠️',
          duration: 6000,
        });
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Box border="1px solid" borderColor={border} borderRadius="10px" p={4} mb={5}>
      <Flex align="center" gap={2} mb={3}>
        <ChefHat size={16} />
        <Text fontWeight="600" fontSize="sm">
          Record a prep run
        </Text>
      </Flex>
      <SimpleGrid columns={2} spacing={3} mb={3}>
        <FormControl>
          <FormLabel fontSize="xs">Batches made</FormLabel>
          <InputGroup size="sm">
            <Input className="numeric" type="number" min={0} step={0.5} value={runs} onChange={(e) => setRuns(e.target.value)} />
            <InputRightAddon fontSize="xs">= {formatQty((item.prepYieldQty ?? 0) * (runsN || 0), item.baseUnit)}</InputRightAddon>
          </InputGroup>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="xs">Use by</FormLabel>
          <Input size="sm" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </FormControl>
      </SimpleGrid>
      <Table size="sm" mb={3}>
        <Tbody>
          {needs.map(({ ingredient, need, short }) =>
            ingredient ? (
              <Tr key={ingredient.item.id}>
                <Td fontSize="xs" pl={0}>
                  {ingredient.item.name}
                </Td>
                <Td className="numeric" fontSize="xs" isNumeric>
                  {formatQty(need, ingredient.item.baseUnit)}
                </Td>
                <Td fontSize="xs" isNumeric pr={0} color={short > 1e-9 ? 'margin.watch' : mutedColor}>
                  {short > 1e-9 ? `${formatQty(short, ingredient.item.baseUnit)} not on record` : 'on hand'}
                </Td>
              </Tr>
            ) : null,
          )}
        </Tbody>
      </Table>
      <Flex justify="space-between" align="center" gap={3}>
        <Text fontSize="xs" color={mutedColor}>
          {shortCount > 0
            ? 'Short ingredients are costed at the price list and surface as variance at the next count.'
            : 'Ingredients come out FEFO, at the price of the batch they came from.'}
        </Text>
        <Button size="sm" onClick={record} isDisabled={!(runsN > 0)} flexShrink={0}>
          Record run
        </Button>
      </Flex>
    </Box>
  );
}
