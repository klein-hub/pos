import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
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
import { ClipboardCopy, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatQty, type PurchaseOrder, type PurchaseOrderStatus, type Supplier } from '@digita/core';
import { ReceiveStockModal } from '../components/inventory/ReceiveStockModal';
import { StockStatusBadge } from '../components/inventory/StatusBadges';
import {
  formatDate,
  formatPesos,
  formatStock,
  plural,
  purchaseOrderProgress,
  type StockRow,
} from '../lib/inventory';
import { useCatalogStore } from '../store/catalogStore';
import { useInventoryStore, type SupplierInput } from '../store/inventoryStore';
import { useStockRows } from '../store/selectors';

const PO_STATUS: Record<PurchaseOrderStatus, { label: string; scheme: string }> = {
  draft: { label: 'Draft', scheme: 'gray' },
  ordered: { label: 'Ordered', scheme: 'blue' },
  partial: { label: 'Part received', scheme: 'orange' },
  received: { label: 'Received', scheme: 'green' },
  cancelled: { label: 'Cancelled', scheme: 'red' },
};

const OPEN_STATUSES = new Set<PurchaseOrderStatus>(['draft', 'ordered', 'partial']);

export function Purchasing() {
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <>
      <Tabs index={tab} onChange={setTab} colorScheme="orange" isLazy>
        <TabList>
          <Tab>Reorder</Tab>
          <Tab>Orders</Tab>
          <Tab>Suppliers</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <ReorderTab
              onDrafted={(id) => {
                setTab(1);
                setEditing(id);
              }}
            />
          </TabPanel>
          <TabPanel px={0}>
            <OrdersTab onOpen={setEditing} />
          </TabPanel>
          <TabPanel px={0}>
            <SuppliersTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
      <PurchaseOrderModal poId={editing} onClose={() => setEditing(null)} />
    </>
  );
}

// --- Reorder -------------------------------------------------------------------

interface Suggestion {
  row: StockRow;
  onOrderUnits: number;
  orderUnits: number;
  estCost: number;
}

/**
 * Suggestions come from suggestReorder: par minus on hand, rounded up to whole
 * purchase units, urgent when cover is shorter than the supplier's lead time.
 * Anything already on an open order is netted off so the same shortfall is
 * never ordered twice.
 */
function ReorderTab({ onDrafted }: { onDrafted: (poId: string) => void }) {
  const rows = useStockRows();
  const items = useCatalogStore((s) => s.items);
  const { suppliers, purchaseOrders, poLines, batches, savePurchaseOrder } = useInventoryStore();
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');

  const onOrder = useMemo(() => {
    const units: Record<string, number> = {};
    for (const po of purchaseOrders.filter((p) => OPEN_STATUSES.has(p.status))) {
      for (const p of purchaseOrderProgress(po.id, poLines, batches, items)) {
        units[p.line.itemId] = (units[p.line.itemId] ?? 0) + Math.max(0, p.outstanding);
      }
    }
    return units;
  }, [purchaseOrders, poLines, batches, items]);

  const withPar = rows.filter((r) => r.reorder);
  const uncountedWithPar = withPar.filter((r) => r.status === 'untracked');

  const suggestions: Suggestion[] = withPar
    .filter((r) => r.status !== 'untracked' && r.reorder!.deficitBaseUnits > 0)
    .map((row) => {
      const onOrderUnits = onOrder[row.item.id] ?? 0;
      const orderUnits = Math.max(
        0,
        Math.ceil((row.reorder!.deficitBaseUnits - onOrderUnits * row.item.packSize) / row.item.packSize),
      );
      return {
        row,
        onOrderUnits,
        orderUnits,
        estCost: orderUnits * row.item.packSize * (row.unitCost ?? 0),
      };
    })
    .filter((s) => s.orderUnits > 0 || s.onOrderUnits > 0);

  const groups = [...new Set(suggestions.map((s) => s.row.item.supplierId ?? ''))].map((supplierId) => ({
    supplier: suppliers.find((s) => s.id === supplierId),
    lines: suggestions
      .filter((s) => (s.row.item.supplierId ?? '') === supplierId)
      .sort((a, b) => Number(b.row.reorder!.urgent) - Number(a.row.reorder!.urgent)),
  }));

  const draft = (supplier: Supplier | undefined, lines: Suggestion[]) => {
    const toOrder = lines.filter((l) => l.orderUnits > 0);
    const id = savePurchaseOrder({
      supplierId: supplier?.id,
      deliveryFee: supplier?.defaultDeliveryFee ?? 0,
      lines: toOrder.map((l) => ({
        itemId: l.row.item.id,
        qtyPurchaseUnits: l.orderUnits,
        linePrice: +l.estCost.toFixed(2),
      })),
    });
    toast.success(`Drafted an order for ${supplier?.name ?? 'items with no supplier'}`);
    onDrafted(id);
  };

  return (
    <Flex direction="column" gap={4}>
      {withPar.length === 0 ? (
        <Alert status="info" borderRadius="10px" fontSize="sm">
          <AlertIcon />
          No item has a par level yet, so there is nothing to suggest. Open an item under Items →
          Settings and set its reorder point and par in purchase units. Once sales and waste are
          recorded, the item will suggest a par from measured use.
        </Alert>
      ) : (
        <Text fontSize="sm" color={muted}>
          {withPar.length} item{withPar.length === 1 ? '' : 's'} with a par level.
          {uncountedWithPar.length > 0 &&
            ` ${uncountedWithPar.length} of them have no stock on record and are left out — count them first, or the suggestion would be their whole par.`}
        </Text>
      )}

      {withPar.length > 0 && suggestions.length === 0 && (
        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={8} textAlign="center">
          <Text fontWeight="600">Nothing to order</Text>
          <Text fontSize="sm" color={muted}>
            Every counted item with a par level is at or above it.
          </Text>
        </Box>
      )}

      {groups.map(({ supplier, lines }) => {
        const subtotal = lines.reduce((sum, l) => sum + l.estCost, 0);
        const urgent = lines.filter((l) => l.row.reorder!.urgent).length;
        return (
          <Box key={supplier?.id ?? 'none'} bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
            <Flex justify="space-between" align="flex-start" mb={3} gap={3} wrap="wrap">
              <Box>
                <Heading size="sm">
                  {supplier?.name ?? 'No supplier assigned'}
                  {urgent > 0 && (
                    <Badge ml={2} colorScheme="red" fontSize="10px">
                      {urgent} urgent
                    </Badge>
                  )}
                </Heading>
                <Text fontSize="xs" color={muted}>
                  {supplier
                    ? `${supplier.leadTimeDays}-day lead time · ${formatPesos(supplier.defaultDeliveryFee)} delivery`
                    : 'Assign suppliers on each item to group orders and flag urgency by lead time.'}
                </Text>
              </Box>
              <Flex align="center" gap={3}>
                <Text className="numeric" fontSize="sm" color={muted}>
                  est. <Text as="span" fontWeight="700">{formatPesos(subtotal)}</Text>
                </Text>
                <Button size="sm" onClick={() => draft(supplier, lines)} isDisabled={lines.every((l) => l.orderUnits === 0)}>
                  Draft order
                </Button>
              </Flex>
            </Flex>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Item</Th>
                    <Th>On hand</Th>
                    <Th>Par</Th>
                    <Th>Cover</Th>
                    <Th>Status</Th>
                    <Th isNumeric>On order</Th>
                    <Th isNumeric>Order</Th>
                    <Th isNumeric>Est. cost</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {lines.map(({ row, onOrderUnits, orderUnits, estCost }) => (
                    <Tr key={row.item.id}>
                      <Td fontWeight="500">{row.item.name}</Td>
                      <Td className="numeric" fontSize="xs">
                        {formatStock(row.onHand, row.item)}
                      </Td>
                      <Td className="numeric" fontSize="xs" color={muted}>
                        {formatStock(row.item.parLevel, row.item)}
                      </Td>
                      <Td className="numeric" fontSize="xs" color={muted}>
                        {Number.isFinite(row.cover) ? `${Math.floor(row.cover)} days` : 'use not measured'}
                      </Td>
                      <Td>
                        <StockStatusBadge row={row} />
                      </Td>
                      <Td className="numeric" isNumeric fontSize="xs" color={muted}>
                        {onOrderUnits > 0 ? `${+onOrderUnits.toFixed(2)}` : '—'}
                      </Td>
                      <Td className="numeric" isNumeric fontWeight="600">
                        {orderUnits} {plural(row.item.purchaseUnit, orderUnits)}
                      </Td>
                      <Td className="numeric" isNumeric>
                        {formatPesos(estCost)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        );
      })}
    </Flex>
  );
}

// --- Orders --------------------------------------------------------------------

function OrdersTab({ onOpen }: { onOpen: (id: string | 'new') => void }) {
  const { purchaseOrders, poLines, suppliers } = useInventoryStore();
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const hoverBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.50');

  const sorted = [...purchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
      <Flex justify="space-between" align="center" mb={4}>
        <Box>
          <Heading size="sm">Orders and deliveries</Heading>
          <Text fontSize="xs" color={muted}>
            Every delivery is recorded here, including ones received without an order.
          </Text>
        </Box>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => onOpen('new')}>
          New order
        </Button>
      </Flex>
      {sorted.length === 0 ? (
        <Text fontSize="sm" color={muted} textAlign="center" py={8}>
          No orders yet. Draft one from Reorder, or start a new one.
        </Text>
      ) : (
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Created</Th>
                <Th>Supplier</Th>
                <Th>Status</Th>
                <Th isNumeric>Lines</Th>
                <Th isNumeric>Value</Th>
                <Th>Expected / received</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sorted.map((po) => {
                const lines = poLines.filter((l) => l.purchaseOrderId === po.id);
                const value = lines.reduce((sum, l) => sum + l.linePrice, 0) + po.deliveryFee;
                return (
                  <Tr key={po.id} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => onOpen(po.id)}>
                    <Td fontSize="xs">{formatDate(po.createdAt, true)}</Td>
                    <Td fontWeight="500">{suppliers.find((s) => s.id === po.supplierId)?.name ?? '—'}</Td>
                    <Td>
                      <Badge colorScheme={PO_STATUS[po.status].scheme} fontSize="10px">
                        {PO_STATUS[po.status].label}
                      </Badge>
                    </Td>
                    <Td className="numeric" isNumeric>
                      {lines.length}
                    </Td>
                    <Td className="numeric" isNumeric>
                      {formatPesos(value)}
                    </Td>
                    <Td fontSize="xs" color={muted}>
                      {po.receivedAt
                        ? `Received ${formatDate(po.receivedAt)}`
                        : po.expectedAt
                          ? `Expected ${formatDate(po.expectedAt)}`
                          : '—'}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

interface DraftLine {
  key: string;
  itemId: string;
  qty: string;
  price: string;
}

function PurchaseOrderModal({ poId, onClose }: { poId: string | 'new' | null; onClose: () => void }) {
  const items = useCatalogStore((s) => s.items);
  const rows = useStockRows();
  const store = useInventoryStore();
  const { suppliers, purchaseOrders, poLines, batches } = store;
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  const po: PurchaseOrder | undefined = purchaseOrders.find((p) => p.id === poId);
  const editable = poId === 'new' || po?.status === 'draft';

  const [supplierId, setSupplierId] = useState('');
  const [fee, setFee] = useState('0');
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [receiving, setReceiving] = useState(false);

  useEffect(() => {
    if (!poId) return;
    setSupplierId(po?.supplierId ?? '');
    setFee(String(po?.deliveryFee ?? 0));
    setExpected(po?.expectedAt ?? '');
    setNotes(po?.notes ?? '');
    const existing = poLines
      .filter((l) => l.purchaseOrderId === poId)
      .map((l) => ({ key: l.id, itemId: l.itemId, qty: String(l.qtyPurchaseUnits), price: String(l.linePrice) }));
    setLines(existing.length > 0 ? existing : [{ key: crypto.randomUUID(), itemId: '', qty: '1', price: '' }]);
    // Seeded once per order opened; re-seeding on store changes would wipe edits.
  }, [poId]);

  if (!poId) return null;

  const orderable = items.filter((i) => i.itemType !== 'sub_assembly').sort((a, b) => a.name.localeCompare(b.name));
  const progress = po ? purchaseOrderProgress(po.id, poLines, batches, items) : [];
  const supplier = suppliers.find((s) => s.id === supplierId);
  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const validLines = lines.filter((l) => l.itemId && Number(l.qty) > 0 && Number(l.price) >= 0 && l.price !== '');
  const total = validLines.reduce((sum, l) => sum + Number(l.price), 0) + (Number(fee) || 0);

  const save = (thenOrder: boolean) => {
    if (validLines.length === 0) {
      toast.error('Add at least one line with a quantity and a price.');
      return;
    }
    try {
      const id = store.savePurchaseOrder({
        id: po?.id,
        supplierId: supplierId || undefined,
        deliveryFee: Number(fee) || 0,
        expectedAt: expected || undefined,
        notes: notes.trim() || undefined,
        lines: validLines.map((l) => ({ itemId: l.itemId, qtyPurchaseUnits: Number(l.qty), linePrice: Number(l.price) })),
      });
      if (thenOrder) store.markOrdered(id);
      toast.success(thenOrder ? 'Marked as ordered' : 'Draft saved');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const copyMessage = async () => {
    const body = poLines
      .filter((l) => l.purchaseOrderId === po?.id)
      .map((l) => {
        const item = items.find((i) => i.id === l.itemId);
        return `• ${l.qtyPurchaseUnits} ${plural(item?.purchaseUnit ?? 'unit', l.qtyPurchaseUnits)} ${item?.name} (${formatQty(item?.packSize ?? 0, item?.baseUnit ?? 'each')})`;
      })
      .join('\n');
    const text = `Hi${supplier ? ` ${supplier.name}` : ''}, we'd like to order:\n${body}\nThank you!`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Order copied — paste it into Messenger or Viber');
    } catch {
      toast.error('Could not reach the clipboard');
    }
  };

  return (
    <>
      <Modal isOpen={!receiving} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex align="center" gap={2}>
              {poId === 'new' ? 'New order' : 'Order'}
              {po && (
                <Badge colorScheme={PO_STATUS[po.status].scheme} fontSize="10px">
                  {PO_STATUS[po.status].label}
                </Badge>
              )}
            </Flex>
            {po && (
              <Text fontSize="sm" fontWeight="400" color={muted}>
                Created {formatDate(po.createdAt, true)}
                {po.orderedAt && ` · ordered ${formatDate(po.orderedAt)}`}
                {po.expectedAt && !po.receivedAt && ` · expected ${formatDate(po.expectedAt)}`}
              </Text>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={5}>
              <FormControl>
                <FormLabel fontSize="sm">Supplier</FormLabel>
                <Select
                  size="sm"
                  value={supplierId}
                  isDisabled={!editable}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    const s = suppliers.find((x) => x.id === e.target.value);
                    if (s && poId === 'new') setFee(String(s.defaultDeliveryFee));
                  }}
                >
                  <option value="">None</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Delivery fee</FormLabel>
                <InputGroup size="sm">
                  <InputLeftElement pointerEvents="none" color={muted} fontSize="xs">
                    ₱
                  </InputLeftElement>
                  <Input className="numeric" type="number" min={0} value={fee} isDisabled={!editable} onChange={(e) => setFee(e.target.value)} />
                </InputGroup>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Expected</FormLabel>
                <Input size="sm" type="date" value={expected} isDisabled={!editable} onChange={(e) => setExpected(e.target.value)} />
                {editable && supplier && (
                  <FormHelperText fontSize="xs">Defaults to {supplier.leadTimeDays} days after ordering.</FormHelperText>
                )}
              </FormControl>
            </SimpleGrid>

            {editable ? (
              <>
                <Box border="1px solid" borderColor={border} borderRadius="10px" overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Item</Th>
                        <Th w="150px">Qty</Th>
                        <Th w="150px">Line price</Th>
                        <Th w="40px" />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {lines.map((line) => {
                        const item = items.find((i) => i.id === line.itemId);
                        const row = rows.find((r) => r.item.id === line.itemId);
                        const estimate = item && row?.unitCost !== undefined ? Number(line.qty) * item.packSize * row.unitCost : undefined;
                        return (
                          <Tr key={line.key}>
                            <Td>
                              <Select size="sm" placeholder="Choose an item…" value={line.itemId} onChange={(e) => update(line.key, { itemId: e.target.value })}>
                                {orderable.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.name}
                                  </option>
                                ))}
                              </Select>
                            </Td>
                            <Td>
                              <InputGroup size="sm">
                                <Input className="numeric" type="number" min={0} value={line.qty} onChange={(e) => update(line.key, { qty: e.target.value })} textAlign="right" />
                                <InputRightAddon fontSize="xs">{item ? plural(item.purchaseUnit, Number(line.qty)) : 'units'}</InputRightAddon>
                              </InputGroup>
                            </Td>
                            <Td>
                              <InputGroup size="sm">
                                <InputLeftElement pointerEvents="none" color={muted} fontSize="xs">
                                  ₱
                                </InputLeftElement>
                                <Input
                                  className="numeric"
                                  type="number"
                                  min={0}
                                  value={line.price}
                                  placeholder={estimate !== undefined && estimate > 0 ? estimate.toFixed(2) : ''}
                                  onChange={(e) => update(line.key, { price: e.target.value })}
                                  textAlign="right"
                                />
                              </InputGroup>
                            </Td>
                            <Td>
                              <IconButton aria-label="Remove line" icon={<X size={14} />} size="xs" variant="ghost" onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))} />
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </Box>
                <Button mt={3} size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={() => setLines((ls) => [...ls, { key: crypto.randomUUID(), itemId: '', qty: '1', price: '' }])}>
                  Add line
                </Button>
                <FormControl mt={4}>
                  <FormLabel fontSize="sm">Notes</FormLabel>
                  <Input size="sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </FormControl>
              </>
            ) : (
              <Box border="1px solid" borderColor={border} borderRadius="10px" overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Item</Th>
                      <Th isNumeric>Ordered</Th>
                      <Th isNumeric>Received</Th>
                      <Th isNumeric>Line price</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {progress.map(({ line, receivedUnits, outstanding }) => {
                      const item = items.find((i) => i.id === line.itemId);
                      return (
                        <Tr key={line.id}>
                          <Td fontWeight="500">{item?.name}</Td>
                          <Td className="numeric" isNumeric>
                            {line.qtyPurchaseUnits} {plural(item?.purchaseUnit ?? '', line.qtyPurchaseUnits)}
                          </Td>
                          <Td className="numeric" isNumeric color={outstanding > 1e-9 ? 'margin.watch' : 'margin.good'}>
                            {+receivedUnits.toFixed(2)}
                          </Td>
                          <Td className="numeric" isNumeric>
                            {formatPesos(line.linePrice)}
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </Box>
            )}
            {po?.notes && !editable && (
              <Text fontSize="sm" color={muted} mt={3}>
                {po.notes}
              </Text>
            )}
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={border} justifyContent="space-between" flexWrap="wrap" gap={3}>
            <Text className="numeric" fontSize="sm" color={muted}>
              Total with delivery <Text as="span" fontWeight="700">{formatPesos(editable ? total : progress.reduce((s, p) => s + p.line.linePrice, 0) + (po?.deliveryFee ?? 0))}</Text>
            </Text>
            <Flex gap={2} wrap="wrap">
              {editable ? (
                <>
                  {po && (
                    <Button
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => {
                        store.deletePurchaseOrder(po.id);
                        onClose();
                      }}
                    >
                      Delete draft
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => save(false)}>
                    Save draft
                  </Button>
                  <Button onClick={() => save(true)}>Mark as ordered</Button>
                </>
              ) : (
                po &&
                (po.status === 'ordered' || po.status === 'partial') && (
                  <>
                    <Button variant="ghost" colorScheme="red" onClick={() => store.cancelPurchaseOrder(po.id)}>
                      Cancel order
                    </Button>
                    <Button variant="outline" leftIcon={<ClipboardCopy size={14} />} onClick={copyMessage}>
                      Copy as message
                    </Button>
                    <Button onClick={() => setReceiving(true)}>
                      {po.status === 'partial' ? 'Receive the rest' : 'Receive delivery'}
                    </Button>
                  </>
                )
              )}
            </Flex>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <ReceiveStockModal
        isOpen={receiving}
        purchaseOrderId={po?.id}
        onClose={() => {
          setReceiving(false);
          onClose();
        }}
      />
    </>
  );
}

// --- Suppliers -----------------------------------------------------------------

function SuppliersTab() {
  const { suppliers } = useInventoryStore();
  const items = useCatalogStore((s) => s.items);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const hoverBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.50');

  return (
    <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
      <Flex justify="space-between" align="center" mb={4}>
        <Box>
          <Heading size="sm">Suppliers</Heading>
          <Text fontSize="xs" color={muted}>
            Lead time drives urgency; the delivery fee pre-fills each receipt and is folded into landed cost.
          </Text>
        </Box>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setEditing('new')}>
          Add supplier
        </Button>
      </Flex>
      {suppliers.length === 0 ? (
        <Text fontSize="sm" color={muted} textAlign="center" py={8}>
          No suppliers yet.
        </Text>
      ) : (
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Contact</Th>
              <Th isNumeric>Lead time</Th>
              <Th isNumeric>Delivery fee</Th>
              <Th isNumeric>Items</Th>
            </Tr>
          </Thead>
          <Tbody>
            {suppliers.map((s) => (
              <Tr key={s.id} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => setEditing(s)}>
                <Td fontWeight="500">{s.name}</Td>
                <Td fontSize="xs" color={muted}>
                  {[s.contact, s.link].filter(Boolean).join(' · ') || '—'}
                </Td>
                <Td className="numeric" isNumeric>
                  {s.leadTimeDays} day{s.leadTimeDays === 1 ? '' : 's'}
                </Td>
                <Td className="numeric" isNumeric>
                  {formatPesos(s.defaultDeliveryFee)}
                </Td>
                <Td className="numeric" isNumeric>
                  {items.filter((i) => i.supplierId === s.id).length}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <SupplierModal supplier={editing} onClose={() => setEditing(null)} />
    </Box>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier | 'new' | null; onClose: () => void }) {
  const { suppliers, saveSupplier } = useInventoryStore();
  const [form, setForm] = useState<SupplierInput>({ name: '', leadTimeDays: 3, defaultDeliveryFee: 0 });

  useEffect(() => {
    if (!supplier) return;
    setForm(supplier === 'new' ? { name: '', contact: '', link: '', leadTimeDays: 3, defaultDeliveryFee: 0 } : { ...supplier });
  }, [supplier]);

  const name = form.name.trim();
  const duplicate = suppliers.some(
    (s) => s.name.toLowerCase() === name.toLowerCase() && (supplier === 'new' || s.id !== supplier?.id),
  );

  const save = () => {
    if (!name || duplicate) return;
    saveSupplier({ ...form, name, contact: form.contact?.trim() || undefined, link: form.link?.trim() || undefined });
    toast.success(`Saved ${name}`);
    onClose();
  };

  return (
    <Modal isOpen={supplier !== null} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{supplier === 'new' ? 'Add supplier' : 'Edit supplier'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody display="flex" flexDirection="column" gap={3}>
          <FormControl isInvalid={duplicate}>
            <FormLabel fontSize="sm">Name</FormLabel>
            <Input size="sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <FormErrorMessage fontSize="xs">A supplier with that name already exists.</FormErrorMessage>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Contact</FormLabel>
            <Input size="sm" value={form.contact ?? ''} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Name, mobile number" />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Link</FormLabel>
            <Input size="sm" value={form.link ?? ''} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Facebook page or Shopee store" />
          </FormControl>
          <SimpleGrid columns={2} spacing={3}>
            <FormControl>
              <FormLabel fontSize="sm">Lead time</FormLabel>
              <InputGroup size="sm">
                <Input className="numeric" type="number" min={0} value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: Math.max(0, Math.round(Number(e.target.value))) })} />
                <InputRightAddon fontSize="xs">days</InputRightAddon>
              </InputGroup>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Usual delivery fee</FormLabel>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none" fontSize="xs">
                  ₱
                </InputLeftElement>
                <Input className="numeric" type="number" min={0} value={form.defaultDeliveryFee} onChange={(e) => setForm({ ...form, defaultDeliveryFee: Math.max(0, Number(e.target.value)) })} />
              </InputGroup>
            </FormControl>
          </SimpleGrid>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} isDisabled={!name || duplicate}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
