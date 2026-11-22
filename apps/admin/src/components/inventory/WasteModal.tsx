import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  InputGroup,
  InputRightAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Wrap,
  WrapItem,
  useColorModeValue,
} from '@chakra-ui/react';
import toast from 'react-hot-toast';
import { consumeStock, formatQty } from '@digita/core';
import { WASTE_KIND_LABEL, formatDate, formatPesos, formatStock, plural } from '../../lib/inventory';
import { useInventoryStore, type WasteEntryKind } from '../../store/inventoryStore';
import { useStockRows } from '../../store/selectors';

export interface WastePreset {
  itemId?: string;
  /** Write off this batch rather than drawing FEFO — an expired bottle, not the open one. */
  batchId?: string;
  qty?: number;
  kind?: WasteEntryKind;
}

interface WasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset?: WastePreset;
}

const KINDS: WasteEntryKind[] = ['spill', 'spoiled', 'expired', 'remake', 'staff', 'other'];

const KIND_HINT: Record<WasteEntryKind, string> = {
  spill: 'Dropped, knocked over, poured wrong.',
  spoiled: 'Went bad before its date — usually storage.',
  expired: 'Reached its date unused — usually over-ordering.',
  remake: 'A drink made again because the first was wrong.',
  staff: 'Staff drinks and meals. Recorded apart from waste.',
  other: 'Say what happened in the note.',
};

/**
 * One form for every way stock leaves other than a sale. Each entry is costed
 * at the price of the batch it actually came out of, not an average, so a
 * spoiled bottle bought at last month's price is valued at last month's price.
 */
export function WasteModal({ isOpen, onClose, preset }: WasteModalProps) {
  const { batches, logWaste } = useInventoryStore();
  const rows = useStockRows();
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');

  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [kind, setKind] = useState<WasteEntryKind>('spill');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setItemId(preset?.itemId ?? '');
    setQty(preset?.qty !== undefined ? String(preset.qty) : '');
    setKind(preset?.kind ?? 'spill');
    setNote('');
  }, [isOpen, preset]);

  const stocked = rows
    .filter((r) => r.onHand > 0)
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
  const row = rows.find((r) => r.item.id === itemId);
  const batch = preset?.batchId ? batches.find((b) => b.id === preset.batchId) : undefined;
  const available = batch ? batch.qtyRemaining : (row?.onHand ?? 0);
  const amount = Number(qty);
  const tooMuch = amount > available + 1e-9;

  const preview = useMemo(() => {
    if (!row || !(amount > 0) || tooMuch) return null;
    let n = 0;
    return consumeStock(
      {
        itemId: row.item.id,
        batches,
        qty: amount,
        reason: kind === 'staff' ? 'staff' : 'waste',
        batchId: preset?.batchId,
      },
      { newId: () => `preview-${++n}`, actorId: 'preview', now: new Date().toISOString() },
    );
  }, [row, amount, tooMuch, kind, batches, preset?.batchId]);

  const submit = () => {
    if (!row || !(amount > 0)) return;
    try {
      const result = logWaste({
        itemId: row.item.id,
        qty: amount,
        kind,
        note: note.trim() || undefined,
        batchId: preset?.batchId,
      });
      toast.success(`${WASTE_KIND_LABEL[kind]}: ${formatQty(amount, row.item.baseUnit)} of ${row.item.name}, ${formatPesos(result.cost)}`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {batch ? 'Write off batch' : 'Log waste or staff use'}
          {batch?.expiryDate && (
            <Text fontSize="sm" fontWeight="400" color={muted}>
              Received {formatDate(batch.receivedAt)}, expires {formatDate(batch.expiryDate, true)}.
            </Text>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody display="flex" flexDirection="column" gap={4}>
          <FormControl>
            <FormLabel fontSize="sm">Item</FormLabel>
            <Select
              size="sm"
              placeholder={stocked.length ? 'Choose an item…' : 'Nothing is in stock yet'}
              value={itemId}
              isDisabled={Boolean(batch)}
              onChange={(e) => setItemId(e.target.value)}
            >
              {stocked.map((r) => (
                <option key={r.item.id} value={r.item.id}>
                  {r.item.name}
                </option>
              ))}
            </Select>
            {row && (
              <FormHelperText fontSize="xs">
                {batch ? 'In this batch' : 'On hand'}: {formatStock(available, row.item)}
              </FormHelperText>
            )}
          </FormControl>

          <FormControl isInvalid={tooMuch}>
            <FormLabel fontSize="sm">Quantity</FormLabel>
            <InputGroup size="sm">
              <Input
                className="numeric"
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                textAlign="right"
                isDisabled={!row}
              />
              <InputRightAddon>{row?.item.baseUnit ?? '—'}</InputRightAddon>
            </InputGroup>
            {tooMuch ? (
              <FormErrorMessage fontSize="xs">
                More than the records hold. Count the item first so the loss is posted against real stock.
              </FormErrorMessage>
            ) : (
              row &&
              row.item.packSize > 1 &&
              amount > 0 && (
                <FormHelperText fontSize="xs">
                  {+(amount / row.item.packSize).toFixed(2)} {plural(row.item.purchaseUnit, amount / row.item.packSize)}
                </FormHelperText>
              )
            )}
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">What happened</FormLabel>
            <Wrap spacing={2}>
              {KINDS.map((k) => (
                <WrapItem key={k}>
                  <Button
                    size="xs"
                    variant={kind === k ? 'solid' : 'outline'}
                    onClick={() => setKind(k)}
                  >
                    {WASTE_KIND_LABEL[k]}
                  </Button>
                </WrapItem>
              ))}
            </Wrap>
            <FormHelperText fontSize="xs">{KIND_HINT[kind]}</FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Note</FormLabel>
            <Input size="sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </FormControl>
        </ModalBody>
        <ModalFooter justifyContent="space-between">
          <Text className="numeric" fontSize="sm" color={muted}>
            {preview ? (
              <>
                Costs <Text as="span" fontWeight="700" color="margin.bad">{formatPesos(preview.cost)}</Text> at batch price
              </>
            ) : (
              ' '
            )}
          </Text>
          <Flex gap={2}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} isDisabled={!preview}>
              Log {WASTE_KIND_LABEL[kind].toLowerCase()}
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
