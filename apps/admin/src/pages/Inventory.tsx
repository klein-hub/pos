import { useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { AlarmClock, Boxes, PackagePlus, Search, ShoppingCart, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatQty, formatUnitCost, reconcileLedger } from '@digita/core';
import { ItemDrawer } from '../components/inventory/ItemDrawer';
import { ReceiveStockModal } from '../components/inventory/ReceiveStockModal';
import { ExpiryBadge, StockStatusBadge } from '../components/inventory/StatusBadges';
import { WasteModal, type WastePreset } from '../components/inventory/WasteModal';
import { StatTile } from '../components/StatTile';
import { STATUS_META, formatPesos, formatStock, isoDate, type StockRow } from '../lib/inventory';
import { useInventoryStore } from '../store/inventoryStore';
import { useStockRows } from '../store/selectors';

type View = 'all' | 'attention' | 'untracked';

const NEEDS_ORDER = new Set<StockRow['status']>(['out', 'critical', 'below_par']);

export function Inventory() {
  const rows = useStockRows();
  const { batches, movements } = useInventoryStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<View>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [receiveFor, setReceiveFor] = useState<string | undefined | null>(null);
  const [wastePreset, setWastePreset] = useState<WastePreset | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const hoverBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.50');

  const categories = useMemo(() => [...new Set(rows.map((r) => r.item.category))].sort(), [rows]);

  const tracked = rows.filter((r) => r.status !== 'untracked');
  const untracked = rows.length - tracked.length;
  const stockValue = rows.reduce((sum, r) => sum + r.value, 0);
  const needOrder = rows.filter((r) => NEEDS_ORDER.has(r.status));
  const expiring = batches.filter(
    (b) => b.qtyRemaining > 0 && b.expiryDate && b.expiryDate <= isoDate(14),
  );
  const atRisk = expiring.reduce((sum, b) => sum + b.qtyRemaining * b.unitCost, 0);
  const mismatches = useMemo(() => reconcileLedger(batches, movements), [batches, movements]);

  const visible = rows
    .filter((r) => !category || r.item.category === category)
    .filter((r) => !search || r.item.name.toLowerCase().includes(search.toLowerCase()))
    .filter((r) =>
      view === 'attention'
        ? NEEDS_ORDER.has(r.status) || r.expiry === 'expired' || r.expiry === 'critical'
        : view === 'untracked'
          ? r.status === 'untracked'
          : true,
    )
    .sort(
      (a, b) =>
        a.item.category.localeCompare(b.item.category) ||
        STATUS_META[a.status].rank - STATUS_META[b.status].rank ||
        a.item.name.localeCompare(b.item.name),
    );

  return (
    <Flex direction="column" gap={4}>
      {tracked.length === 0 && (
        <Alert status="info" borderRadius="10px" fontSize="sm" alignItems="flex-start">
          <AlertIcon />
          <Box>
            <Text>
              No stock is recorded yet, and none has been made up — the shop's real quantities are
              unknown until someone counts them. Start with an opening count, or receive the next
              delivery. Costs until then come from your price list.
            </Text>
            <Button size="xs" mt={2} variant="outline" onClick={() => navigate('/counts')}>
              Start an opening count
            </Button>
          </Box>
        </Alert>
      )}

      <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={3}>
        <StatTile
          label="Stock value"
          value={formatPesos(stockValue)}
          icon={Wallet}
          hint={`${tracked.length} of ${rows.length} items counted`}
        />
        <StatTile
          label="Need ordering"
          value={String(needOrder.length)}
          icon={ShoppingCart}
          hint={needOrder.length ? needOrder.slice(0, 2).map((r) => r.item.name).join(', ') : 'Nothing below par'}
        />
        <StatTile
          label="Expiring ≤ 14 days"
          value={formatPesos(atRisk)}
          icon={AlarmClock}
          hint={`${expiring.length} batch${expiring.length === 1 ? '' : 'es'}`}
        />
        <StatTile
          label="Not counted yet"
          value={String(untracked)}
          icon={Boxes}
          hint={untracked ? 'No stock on record' : 'Every item has stock history'}
        />
      </SimpleGrid>

      <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
        <Flex gap={3} mb={4} wrap="wrap" align="center">
          <InputGroup size="sm" maxW="260px">
            <InputLeftElement pointerEvents="none" color={muted}>
              <Search size={14} />
            </InputLeftElement>
            <Input placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
          </InputGroup>
          <Select size="sm" maxW="180px" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <ButtonGroup size="sm" isAttached variant="outline">
            {(
              [
                ['all', 'All'],
                ['attention', 'Needs attention'],
                ['untracked', 'Not counted'],
              ] as [View, string][]
            ).map(([key, label]) => (
              <Button key={key} variant={view === key ? 'solid' : 'outline'} onClick={() => setView(key)}>
                {label}
              </Button>
            ))}
          </ButtonGroup>
          <Box flex="1" />
          <Button size="sm" leftIcon={<PackagePlus size={16} />} onClick={() => setReceiveFor(undefined)}>
            Receive stock
          </Button>
        </Flex>

        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Item</Th>
                <Th>On hand</Th>
                <Th isNumeric>Unit cost</Th>
                <Th isNumeric>Value</Th>
                <Th>Use</Th>
                <Th>Next expiry</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visible.map((row) => (
                <Tr
                  key={row.item.id}
                  cursor="pointer"
                  _hover={{ bg: hoverBg }}
                  onClick={() => setSelected(row.item.id)}
                >
                  <Td>
                    <Text fontWeight="500">
                      {row.item.name}
                      {row.item.itemType === 'sub_assembly' && (
                        <Badge ml={2} fontSize="9px" colorScheme="orange" variant="outline">
                          prep
                        </Badge>
                      )}
                    </Text>
                    <Text fontSize="xs" color={muted}>
                      {row.item.category}
                      {row.supplier ? ` · ${row.supplier.name}` : ''}
                    </Text>
                  </Td>
                  <Td className="numeric" fontSize="sm" color={row.status === 'untracked' ? muted : undefined}>
                    {row.status === 'untracked' ? '—' : formatStock(row.onHand, row.item)}
                  </Td>
                  <Td className="numeric" isNumeric fontSize="xs">
                    {row.unitCost !== undefined ? formatUnitCost(row.unitCost, row.item.baseUnit) : '—'}
                    {(row.costSource === 'standard' || row.costSource === 'recipe') && (
                      <Text color={muted} fontSize="10px">
                        {row.costSource === 'standard' ? 'price list' : 'from recipe'}
                      </Text>
                    )}
                  </Td>
                  <Td className="numeric" isNumeric fontSize="sm">
                    {row.value > 0 ? formatPesos(row.value) : '—'}
                  </Td>
                  <Td className="numeric" fontSize="xs" color={muted}>
                    {row.velocity.perDay > 0 ? (
                      <>
                        {formatQty(row.velocity.perDay, row.item.baseUnit)}/day
                        {Number.isFinite(row.cover) && (
                          <Text>{Math.floor(row.cover)} days cover</Text>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    {row.nextExpiry && row.expiry ? <ExpiryBadge date={row.nextExpiry} status={row.expiry} /> : null}
                  </Td>
                  <Td>
                    <StockStatusBadge row={row} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {visible.length === 0 && (
            <Text fontSize="sm" color={muted} textAlign="center" py={8}>
              Nothing matches.
            </Text>
          )}
        </Box>

        <Text fontSize="xs" color={mismatches.length ? 'margin.bad' : muted} mt={4}>
          {mismatches.length === 0
            ? `Ledger balanced: every batch equals the sum of its ${movements.length} movement${movements.length === 1 ? '' : 's'}.`
            : `${mismatches.length} batch${mismatches.length === 1 ? '' : 'es'} no longer match their movements — on hand cannot be trusted until this is fixed.`}
        </Text>
      </Box>

      <ItemDrawer
        itemId={selected}
        onClose={() => setSelected(null)}
        onReceive={(id) => setReceiveFor(id)}
        onWaste={(preset) => setWastePreset(preset)}
      />
      <ReceiveStockModal
        isOpen={receiveFor !== null}
        onClose={() => setReceiveFor(null)}
        initialItemId={receiveFor ?? undefined}
      />
      <WasteModal isOpen={wastePreset !== null} onClose={() => setWastePreset(null)} preset={wastePreset ?? undefined} />
    </Flex>
  );
}
