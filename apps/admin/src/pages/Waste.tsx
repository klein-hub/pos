import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  Heading,
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
import { AlarmClock, Coffee, Plus, Trash2, TrendingDown } from 'lucide-react';
import { expiryStatus, formatQty, type StockMovement } from '@digita/core';
import { ExpiryBadge } from '../components/inventory/StatusBadges';
import { WasteModal, type WastePreset } from '../components/inventory/WasteModal';
import { StatTile } from '../components/StatTile';
import { WASTE_KIND_LABEL, formatDateTime, formatPesos, isoDate } from '../lib/inventory';
import { useCatalogStore } from '../store/catalogStore';
import { useInventoryStore, type WasteEntryKind } from '../store/inventoryStore';

const PERIODS = [7, 28, 90] as const;

interface Entry {
  key: string;
  itemId: string;
  kind: WasteEntryKind;
  qty: number;
  cost: number;
  note?: string;
  occurredAt: string;
}

/** A logged entry can draw from two batches; its movements share a reference. */
function toEntries(movements: readonly StockMovement[]): Entry[] {
  const byRef = new Map<string, Entry>();
  for (const m of movements) {
    const key = m.referenceId ?? m.id;
    const existing = byRef.get(key);
    const cost = -m.qty * m.costAtTime;
    if (existing) {
      existing.qty += -m.qty;
      existing.cost += cost;
    } else {
      byRef.set(key, {
        key,
        itemId: m.itemId,
        kind: m.reason === 'staff' ? 'staff' : (m.wasteKind ?? 'other'),
        qty: -m.qty,
        cost,
        note: m.note,
        occurredAt: m.occurredAt,
      });
    }
  }
  return [...byRef.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function Waste() {
  const { movements, batches } = useInventoryStore();
  const items = useCatalogStore((s) => s.items);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(28);
  const [preset, setPreset] = useState<WastePreset | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;

  const entries = useMemo(() => {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    return toEntries(movements.filter((m) => (m.reason === 'waste' || m.reason === 'staff') && m.occurredAt >= since));
  }, [movements, days]);

  const waste = entries.filter((e) => e.kind !== 'staff');
  const staff = entries.filter((e) => e.kind === 'staff');
  const wasteCost = waste.reduce((s, e) => s + e.cost, 0);
  const staffCost = staff.reduce((s, e) => s + e.cost, 0);

  const byKind = rank(entries, (e) => WASTE_KIND_LABEL[e.kind]);
  const byItem = rank(waste, (e) => itemName(e.itemId));
  const topItems = byItem.slice(0, 7);
  const rest = byItem.slice(7);
  if (rest.length > 0) {
    topItems.push({
      label: `${rest.length} other item${rest.length === 1 ? '' : 's'}`,
      value: rest.reduce((s, r) => s + r.value, 0),
      count: rest.reduce((s, r) => s + r.count, 0),
      muted: true,
    });
  }

  const horizon = isoDate(14);
  const atRisk = batches
    .filter((b) => b.qtyRemaining > 0 && b.expiryDate && b.expiryDate <= horizon)
    .sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!));
  const atRiskValue = atRisk.reduce((s, b) => s + b.qtyRemaining * b.unitCost, 0);

  return (
    <Flex direction="column" gap={4}>
      <Flex justify="space-between" align="center" gap={3} wrap="wrap">
        <ButtonGroup size="sm" isAttached variant="outline">
          {PERIODS.map((p) => (
            <Button key={p} variant={days === p ? 'solid' : 'outline'} onClick={() => setDays(p)}>
              {p} days
            </Button>
          ))}
        </ButtonGroup>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setPreset({})}>
          Log waste
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={3}>
        <StatTile label="Waste" value={formatPesos(wasteCost)} icon={Trash2} hint={`${waste.length} entr${waste.length === 1 ? 'y' : 'ies'}`} />
        <StatTile label="Staff use" value={formatPesos(staffCost)} icon={Coffee} hint="Recorded apart from waste" />
        <StatTile
          label="Biggest loss"
          value={byItem[0] ? formatPesos(byItem[0].value) : '—'}
          icon={TrendingDown}
          hint={byItem[0]?.label ?? 'Nothing logged'}
        />
        <StatTile label="Expiring ≤ 14 days" value={formatPesos(atRiskValue)} icon={AlarmClock} hint={`${atRisk.length} batch${atRisk.length === 1 ? '' : 'es'} — use or write off`} />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
          <Heading size="sm" mb={1}>
            By cause
          </Heading>
          <Text fontSize="xs" color={muted} mb={4}>
            Spoiled and expired point at ordering; spills and remakes at the bar.
          </Text>
          <RankedBars data={byKind} empty="Nothing logged in this period." />
        </Box>
        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
          <Heading size="sm" mb={1}>
            By item
          </Heading>
          <Text fontSize="xs" color={muted} mb={4}>
            Waste only, valued at the price of the batch each loss came from.
          </Text>
          <RankedBars data={topItems} empty="No waste in this period." />
        </Box>
      </Grid>

      <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
        <Heading size="sm" mb={1}>
          Expiry watch
        </Heading>
        <Text fontSize="xs" color={muted} mb={4}>
          Stock reaching its date within two weeks. Move it to the front, use it in specials, or
          write it off once it has turned.
        </Text>
        {atRisk.length === 0 ? (
          <Text fontSize="sm" color={muted}>
            Nothing on record expires in the next 14 days.
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Item</Th>
                  <Th>Expires</Th>
                  <Th isNumeric>Left</Th>
                  <Th isNumeric>Value</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {atRisk.map((b) => {
                  const item = items.find((i) => i.id === b.itemId);
                  const status = expiryStatus(b);
                  return (
                    <Tr key={b.id}>
                      <Td fontWeight="500">{item?.name}</Td>
                      <Td>
                        <ExpiryBadge date={b.expiryDate!} status={status} />
                      </Td>
                      <Td className="numeric" isNumeric fontSize="xs">
                        {item ? formatQty(b.qtyRemaining, item.baseUnit) : b.qtyRemaining}
                      </Td>
                      <Td className="numeric" isNumeric>
                        {formatPesos(b.qtyRemaining * b.unitCost)}
                      </Td>
                      <Td isNumeric>
                        <Button
                          size="xs"
                          variant={status === 'expired' ? 'solid' : 'ghost'}
                          colorScheme="red"
                          onClick={() =>
                            setPreset({ itemId: b.itemId, batchId: b.id, qty: b.qtyRemaining, kind: status === 'expired' ? 'expired' : 'spoiled' })
                          }
                        >
                          Write off
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
        <Heading size="sm" mb={4}>
          Log
        </Heading>
        {entries.length === 0 ? (
          <Text fontSize="sm" color={muted}>
            No waste or staff use logged in the last {days} days.
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>When</Th>
                  <Th>Item</Th>
                  <Th>What</Th>
                  <Th isNumeric>Qty</Th>
                  <Th isNumeric>Cost</Th>
                  <Th>Note</Th>
                </Tr>
              </Thead>
              <Tbody>
                {entries.map((e) => {
                  const item = items.find((i) => i.id === e.itemId);
                  return (
                    <Tr key={e.key}>
                      <Td fontSize="xs" whiteSpace="nowrap">
                        {formatDateTime(e.occurredAt)}
                      </Td>
                      <Td fontWeight="500">{item?.name}</Td>
                      <Td fontSize="xs">{WASTE_KIND_LABEL[e.kind]}</Td>
                      <Td className="numeric" isNumeric fontSize="xs">
                        {item ? formatQty(e.qty, item.baseUnit) : e.qty}
                      </Td>
                      <Td className="numeric" isNumeric fontWeight="600">
                        {formatPesos(e.cost)}
                      </Td>
                      <Td fontSize="xs" color={muted} maxW="240px">
                        <Text noOfLines={1}>{e.note ?? ''}</Text>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <WasteModal isOpen={preset !== null} onClose={() => setPreset(null)} preset={preset ?? undefined} />
    </Flex>
  );
}

interface Ranked {
  label: string;
  value: number;
  count: number;
  /** A folded tail, drawn in the recessive gray. */
  muted?: boolean;
}

function rank(entries: readonly Entry[], key: (e: Entry) => string): Ranked[] {
  const map = new Map<string, Ranked>();
  for (const e of entries) {
    const label = key(e);
    const r = map.get(label) ?? { label, value: 0, count: 0 };
    r.value += e.cost;
    r.count += 1;
    map.set(label, r);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/**
 * Ranked horizontal bars, one hue, largest first: the parts are compared with
 * each other, so they share one baseline rather than sitting end to end. The
 * value rides at the bar's tip in text ink; each row is its own hover and focus
 * target with the full figures.
 */
function RankedBars({ data, empty }: { data: Ranked[]; empty: string }) {
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const barColor = useColorModeValue('primary.400', 'primary.300');
  const tailColor = useColorModeValue('gray.300', 'whiteAlpha.400');
  const focusRing = useColorModeValue('primary.200', 'primary.600');

  if (data.length === 0) {
    return (
      <Text fontSize="sm" color={muted}>
        {empty}
      </Text>
    );
  }

  const max = Math.max(...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Flex direction="column" gap={2.5}>
      {data.map((d) => {
        const share = total > 0 ? d.value / total : 0;
        const label = `${d.label}: ${formatPesos(d.value)}, ${d.count} entr${d.count === 1 ? 'y' : 'ies'}, ${(share * 100).toFixed(0)}% of the total`;
        return (
          <Tooltip key={d.label} label={label} openDelay={100} hasArrow placement="top">
            <Flex
              align="center"
              gap={3}
              tabIndex={0}
              aria-label={label}
              borderRadius="4px"
              _focusVisible={{ outline: '2px solid', outlineColor: focusRing, outlineOffset: '2px' }}
            >
              <Text fontSize="xs" w="130px" flexShrink={0} noOfLines={1}>
                {d.label}
              </Text>
              <Flex flex="1" align="center" gap={2} minW={0}>
                <Box
                  h="10px"
                  // Scaled within the space left after the value label, so the
                  // longest bar still has room for its figure at the tip.
                  w={`calc((100% - 84px) * ${max > 0 ? Math.max(0.01, d.value / max) : 0})`}
                  bg={d.muted ? tailColor : barColor}
                  borderRightRadius="4px"
                  transition="width 150ms ease"
                />
                <Text className="numeric" fontSize="xs" fontWeight="600" whiteSpace="nowrap">
                  {formatPesos(d.value)}
                </Text>
              </Flex>
            </Flex>
          </Tooltip>
        );
      })}
    </Flex>
  );
}
