import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  formatUnitCost,
  receiveStock,
  resolveUnitCost,
  type InventoryItem,
  type ReceiptLineInput,
} from '@digita/core';
import { formatPesos, isoDate, plural, purchaseOrderProgress } from '../../lib/inventory';
import { useCatalogStore } from '../../store/catalogStore';
import { useInventoryStore, type ReceiveLine } from '../../store/inventoryStore';

interface ReceiveStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receive against an order: supplier, outstanding lines and agreed prices come pre-filled. */
  purchaseOrderId?: string;
  /** Start with one line for this item. */
  initialItemId?: string;
}

interface DraftLine {
  key: string;
  itemId: string;
  qty: string;
  packSize: string;
  price: string;
  expiry: string;
}

const blankLine = (item?: InventoryItem): DraftLine => ({
  key: crypto.randomUUID(),
  itemId: item?.id ?? '',
  qty: item ? '1' : '',
  packSize: item ? String(item.packSize) : '',
  price: '',
  expiry: item?.shelfLifeDays ? isoDate(item.shelfLifeDays) : '',
});

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

/**
 * Receive Stock — the keystone screen. It records what was actually paid, per
 * line, with the delivery fee spread across lines by value, and shows the
 * landed cost per gram before anything is posted. The preview runs the same
 * receiveStock the store posts with, so the number on screen is the number
 * that lands in the batch.
 */
export function ReceiveStockModal({ isOpen, onClose, purchaseOrderId, initialItemId }: ReceiveStockModalProps) {
  const items = useCatalogStore((s) => s.items);
  const unitCosts = useCatalogStore((s) => s.unitCosts);
  const { suppliers, purchaseOrders, poLines, batches, receive } = useInventoryStore();

  const [supplierId, setSupplierId] = useState('');
  const [fee, setFee] = useState('0');
  const [feeTouched, setFeeTouched] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState('');

  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  const po = purchaseOrders.find((p) => p.id === purchaseOrderId);
  const receivable = useMemo(
    () =>
      items
        .filter((i) => i.itemType !== 'sub_assembly')
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [items],
  );
  const categories = [...new Set(receivable.map((i) => i.category))];
  const itemById = (id: string) => items.find((i) => i.id === id);

  // Reset on every open: a half-entered delivery from last time is a trap.
  useEffect(() => {
    if (!isOpen) return;
    setNote('');
    setFeeTouched(false);
    if (po) {
      const progress = purchaseOrderProgress(po.id, poLines, batches, items);
      const nothingYet = progress.every((p) => p.receivedUnits === 0);
      setSupplierId(po.supplierId ?? '');
      setFee(String(nothingYet ? po.deliveryFee : 0));
      setLines(
        progress
          .filter((p) => p.outstanding > 0)
          .map(({ line, outstanding }) => {
            const item = itemById(line.itemId);
            return {
              ...blankLine(item),
              qty: String(+outstanding.toFixed(4)),
              price: String(+((line.linePrice * outstanding) / line.qtyPurchaseUnits).toFixed(2)),
            };
          }),
      );
    } else {
      setSupplierId('');
      setFee('0');
      setLines([blankLine(initialItemId ? itemById(initialItemId) : undefined)]);
    }
    // Seeded once per open; re-running on every store change would wipe what was typed.
  }, [isOpen, purchaseOrderId, initialItemId]);

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const chooseItem = (key: string, itemId: string) => {
    const item = itemById(itemId);
    update(key, { ...blankLine(item), key, qty: lines.find((l) => l.key === key)?.qty || '1' });
  };

  const chooseSupplier = (id: string) => {
    setSupplierId(id);
    if (!feeTouched) setFee(String(suppliers.find((s) => s.id === id)?.defaultDeliveryFee ?? 0));
  };

  const valid = (l: DraftLine) =>
    Boolean(itemById(l.itemId)) && num(l.qty) > 0 && num(l.packSize) > 0 && num(l.price) >= 0;
  const deliveryFee = Math.max(0, num(fee) || 0);
  const ready = lines.filter(valid);

  // Same function the store posts with, run on a throwaway context.
  const preview = useMemo(() => {
    if (ready.length === 0) return null;
    try {
      let n = 0;
      return receiveStock(
        {
          deliveryFee,
          lines: ready.map(
            (l): ReceiptLineInput => ({
              item: itemById(l.itemId)!,
              qtyPurchaseUnits: num(l.qty),
              linePrice: num(l.price),
              labelPackSize: num(l.packSize),
            }),
          ),
        },
        { newId: () => `preview-${++n}`, actorId: 'preview', now: new Date().toISOString() },
      );
    } catch {
      return null;
    }
  }, [lines, deliveryFee, items]);

  const previewByKey = new Map(ready.map((l, i) => [l.key, preview?.lines[i]]));
  const goods = ready.reduce((sum, l) => sum + num(l.price), 0);
  const today = isoDate();

  const submit = () => {
    const incomplete = lines.filter((l) => l.itemId && !valid(l));
    if (incomplete.length > 0) {
      toast.error('Every line needs a quantity, a pack size and the price paid.');
      return;
    }
    if (ready.length === 0) {
      toast.error('Add at least one item.');
      return;
    }
    try {
      receive({
        supplierId: supplierId || undefined,
        deliveryFee,
        purchaseOrderId: po?.id,
        note: note.trim() || undefined,
        lines: ready.map(
          (l): ReceiveLine => ({
            itemId: l.itemId,
            qtyPurchaseUnits: num(l.qty),
            linePrice: num(l.price),
            packSize: num(l.packSize) === itemById(l.itemId)!.packSize ? undefined : num(l.packSize),
            expiryDate: l.expiry || undefined,
          }),
        ),
      });
      toast.success(
        `Received ${ready.length} line${ready.length === 1 ? '' : 's'} · ${formatPesos(goods + deliveryFee)} landed`,
      );
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {po ? 'Receive delivery' : 'Receive stock'}
          <Text fontSize="sm" fontWeight="400" color={muted}>
            Enter what the receipt says you paid. Delivery is spread across the lines by value, so
            the cost per gram includes it.
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={5}>
            <FormControl>
              <FormLabel fontSize="sm">Supplier</FormLabel>
              <Select
                size="sm"
                value={supplierId}
                onChange={(e) => chooseSupplier(e.target.value)}
                isDisabled={Boolean(po)}
              >
                <option value="">No supplier (market run)</option>
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
                <Input
                  className="numeric"
                  type="number"
                  min={0}
                  value={fee}
                  onChange={(e) => {
                    setFee(e.target.value);
                    setFeeTouched(true);
                  }}
                />
              </InputGroup>
              <FormHelperText fontSize="xs">Kept separate from item prices, then folded into landed cost.</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Note</FormLabel>
              <Input size="sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Receipt no., who received it…" />
            </FormControl>
          </SimpleGrid>

          <Box overflowX="auto" border="1px solid" borderColor={border} borderRadius="10px">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th minW="220px">Item</Th>
                  <Th w="110px">Qty</Th>
                  <Th w="130px">
                    <Tooltip label="Base units in one purchase unit. Change it when this delivery's bottle or pack size differs from usual.">
                      Pack size
                    </Tooltip>
                  </Th>
                  <Th w="130px">Price paid</Th>
                  <Th w="150px">Expiry</Th>
                  <Th isNumeric>Landed cost</Th>
                  <Th isNumeric>vs current</Th>
                  <Th w="40px" />
                </Tr>
              </Thead>
              <Tbody>
                {lines.map((line) => {
                  const item = itemById(line.itemId);
                  const landed = previewByKey.get(line.key);
                  const current = item
                    ? resolveUnitCost(batches.filter((b) => b.itemId === item.id), unitCosts[item.id]).unitCost
                    : undefined;
                  const delta = landed && current ? (landed.unitCost - current) / current : undefined;
                  const lastPackPrice = item && current !== undefined ? current * item.packSize : undefined;

                  return (
                    <Tr key={line.key}>
                      <Td>
                        <Select size="sm" value={line.itemId} placeholder="Choose an item…" onChange={(e) => chooseItem(line.key, e.target.value)}>
                          {categories.map((cat) => (
                            <optgroup key={cat} label={cat}>
                              {receivable
                                .filter((i) => i.category === cat)
                                .map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.name}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </Select>
                      </Td>
                      <Td>
                        <Flex align="center" gap={1}>
                          <Input
                            className="numeric"
                            size="sm"
                            type="number"
                            min={0}
                            value={line.qty}
                            onChange={(e) => update(line.key, { qty: e.target.value })}
                            textAlign="right"
                          />
                          <Text fontSize="xs" color={muted} whiteSpace="nowrap">
                            {item ? plural(item.purchaseUnit, num(line.qty)) : ''}
                          </Text>
                        </Flex>
                      </Td>
                      <Td>
                        <Flex align="center" gap={1}>
                          <Input
                            className="numeric"
                            size="sm"
                            type="number"
                            min={0}
                            value={line.packSize}
                            onChange={(e) => update(line.key, { packSize: e.target.value })}
                            textAlign="right"
                          />
                          <Text fontSize="xs" color={muted}>
                            {item?.baseUnit}
                          </Text>
                        </Flex>
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
                            placeholder={
                              lastPackPrice !== undefined && num(line.qty) > 0
                                ? (lastPackPrice * num(line.qty)).toFixed(2)
                                : ''
                            }
                            onChange={(e) => update(line.key, { price: e.target.value })}
                            textAlign="right"
                          />
                        </InputGroup>
                      </Td>
                      <Td>
                        <Input
                          size="sm"
                          type="date"
                          value={line.expiry}
                          onChange={(e) => update(line.key, { expiry: e.target.value })}
                          borderColor={line.expiry && line.expiry < today ? 'red.400' : undefined}
                        />
                      </Td>
                      <Td className="numeric" isNumeric fontSize="xs">
                        {landed && item ? formatUnitCost(landed.unitCost, item.baseUnit) : '—'}
                      </Td>
                      <Td isNumeric>
                        {delta !== undefined && Math.abs(delta) >= 0.005 ? (
                          <Badge className="numeric" colorScheme={delta > 0 ? 'red' : 'green'} fontSize="10px">
                            {delta > 0 ? '+' : ''}
                            {(delta * 100).toFixed(1)}%
                          </Badge>
                        ) : delta !== undefined ? (
                          <Text fontSize="xs" color={muted}>
                            same
                          </Text>
                        ) : null}
                      </Td>
                      <Td>
                        <IconButton
                          aria-label="Remove line"
                          icon={<X size={14} />}
                          size="xs"
                          variant="ghost"
                          onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>

          <Button mt={3} size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={() => setLines((ls) => [...ls, blankLine()])}>
            Add line
          </Button>

          {lines.some((l) => l.expiry && l.expiry < today) && (
            <Alert status="warning" borderRadius="8px" fontSize="sm" mt={3}>
              <AlertIcon />
              A line is already past its expiry date. Receive it only if it really arrived that way —
              it will show up straight away in the expiry watch.
            </Alert>
          )}
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor={border} justifyContent="space-between" gap={4} flexWrap="wrap">
          <Flex gap={5} fontSize="sm" className="numeric">
            <Text color={muted}>
              Goods <Text as="span" fontWeight="600">{formatPesos(goods)}</Text>
            </Text>
            <Text color={muted}>
              Delivery <Text as="span" fontWeight="600">{formatPesos(deliveryFee)}</Text>
            </Text>
            <Text color={muted}>
              Landed <Text as="span" fontWeight="700">{formatPesos(goods + deliveryFee)}</Text>
            </Text>
          </Flex>
          <Flex gap={2}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} isDisabled={ready.length === 0}>
              Receive {ready.length > 0 ? `${ready.length} line${ready.length === 1 ? '' : 's'}` : 'stock'}
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
