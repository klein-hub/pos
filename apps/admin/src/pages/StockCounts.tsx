import { useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightAddon,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { ArrowDownRight, ArrowUpRight, ClipboardCheck, PackageCheck, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { countStock, formatQty, type StockCount, type StockCountLine } from '@digita/core';
import { StatTile } from '../components/StatTile';
import { formatDate, formatDateTime, formatPesos, formatStock, plural, type StockRow } from '../lib/inventory';
import { useCatalogStore } from '../store/catalogStore';
import { useInventoryStore } from '../store/inventoryStore';
import { useStockRows } from '../store/selectors';

/**
 * Physical counts: the theoretical-versus-actual check. Expected is what the
 * ledger says should be there — deliveries in, recipes and logged waste out —
 * and the gap to what is on the shelf is everything nobody recorded:
 * over-pouring, unlogged spills, stock walking out the door.
 */
export function StockCounts() {
  const counts = useInventoryStore((s) => s.counts);
  const open = counts.find((c) => c.status === 'open');

  return (
    <Flex direction="column" gap={4}>
      {open ? <CountSheet count={open} /> : <StartCount />}
      <CountHistory />
    </Flex>
  );
}

type Scope = 'all' | 'category' | 'tracked' | 'untracked';

function StartCount() {
  const rows = useStockRows();
  const startCount = useInventoryStore((s) => s.startCount);
  const [scope, setScope] = useState<Scope>(() => (rows.every((r) => r.status === 'untracked') ? 'untracked' : 'tracked'));
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');

  const categories = [...new Set(rows.map((r) => r.item.category))].sort();
  const inScope = rows.filter((r) =>
    scope === 'category'
      ? r.item.category === category
      : scope === 'tracked'
        ? r.status !== 'untracked'
        : scope === 'untracked'
          ? r.status === 'untracked'
          : true,
  );
  const untracked = rows.filter((r) => r.status === 'untracked').length;

  const start = () => {
    try {
      startCount(
        inScope.map((r) => r.item.id),
        note.trim() || (scope === 'untracked' ? 'Opening count' : undefined),
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
      <Heading size="sm" mb={1}>
        Start a count
      </Heading>
      <Text fontSize="xs" color={muted} mb={4} maxW="680px">
        Expected quantities stay hidden while counting, so they cannot anchor what gets written
        down. You see them, and the variance, on the review step before anything is posted.
      </Text>

      {untracked > 0 && (
        <Alert status="info" borderRadius="8px" fontSize="sm" mb={4}>
          <AlertIcon />
          {untracked} item{untracked === 1 ? ' has' : 's have'} no stock on record. Counting them
          sets an opening balance at the price list — reported apart from variance, because a first
          count has nothing to differ from.
        </Alert>
      )}

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <FormControl>
          <FormLabel fontSize="sm">What to count</FormLabel>
          <RadioGroup value={scope} onChange={(v) => setScope(v as Scope)} colorScheme="orange">
            <Stack spacing={2} fontSize="sm">
              <Radio value="tracked" isDisabled={untracked === rows.length}>
                Items with stock on record ({rows.length - untracked})
              </Radio>
              <Radio value="untracked" isDisabled={untracked === 0}>
                Opening count — items never counted ({untracked})
              </Radio>
              <Radio value="category">One category</Radio>
              <Radio value="all">Everything ({rows.length})</Radio>
            </Stack>
          </RadioGroup>
          {scope === 'category' && (
            <Select size="sm" mt={2} maxW="240px" placeholder="Choose a category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </FormControl>
        <Flex direction="column" gap={3} justify="space-between">
          <FormControl>
            <FormLabel fontSize="sm">Note</FormLabel>
            <Input size="sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Month-end, after closing…" />
          </FormControl>
          <Flex justify="flex-end">
            <Button leftIcon={<ClipboardCheck size={16} />} onClick={start} isDisabled={inScope.length === 0}>
              Count {inScope.length} item{inScope.length === 1 ? '' : 's'}
            </Button>
          </Flex>
        </Flex>
      </SimpleGrid>
    </Box>
  );
}

/**
 * Entries are sealed units plus what is left in the open one — the way stock
 * actually sits on the shelf — and stored in base units.
 */
interface Entry {
  sealed: string;
  loose: string;
}

const splits = (item: StockRow['item']) => item.packSize > 1 && item.itemType !== 'sub_assembly';

function CountSheet({ count }: { count: StockCount }) {
  const rows = useStockRows();
  const { batches, countScopes, countDrafts, setCounted, postCount, cancelCount } = useInventoryStore();
  const unitCosts = useCatalogStore((s) => s.unitCosts);
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const doneBg = useColorModeValue('green.50', 'whiteAlpha.50');

  const scope = countScopes[count.id] ?? [];
  const draft = countDrafts[count.id] ?? {};
  const scoped = rows
    .filter((r) => scope.includes(r.item.id))
    .sort((a, b) => a.item.category.localeCompare(b.item.category) || a.item.name.localeCompare(b.item.name));

  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      Object.entries(draft).map(([itemId, qty]) => {
        const item = rows.find((r) => r.item.id === itemId)?.item;
        if (!item || !splits(item)) return [itemId, { sealed: '', loose: String(qty) }];
        const sealed = Math.floor(qty / item.packSize);
        return [itemId, { sealed: String(sealed), loose: String(+(qty - sealed * item.packSize).toFixed(4)) }];
      }),
    ),
  );
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const enter = (row: StockRow, patch: Partial<Entry>) => {
    const next = { sealed: '', loose: '', ...entries[row.item.id], ...patch };
    setEntries((e) => ({ ...e, [row.item.id]: next }));
    if (next.sealed.trim() === '' && next.loose.trim() === '') {
      setCounted(count.id, row.item.id, null);
      return;
    }
    const total = (Number(next.sealed) || 0) * (splits(row.item) ? row.item.packSize : 0) + (Number(next.loose) || 0);
    setCounted(count.id, row.item.id, Math.max(0, total));
  };

  const counted = scoped.filter((r) => draft[r.item.id] !== undefined);
  const visible = scoped.filter((r) => !search || r.item.name.toLowerCase().includes(search.toLowerCase()));

  // Same function the post uses, on a throwaway context: the review shows
  // exactly what will be posted.
  const preview = useMemo(() => {
    let n = 0;
    const ctx = { newId: () => `preview-${++n}`, actorId: 'preview', now: new Date().toISOString() };
    return counted.map((row) => ({
      row,
      result: countStock(
        {
          itemId: row.item.id,
          batches,
          countedQty: draft[row.item.id]!,
          fallbackUnitCost: row.unitCost ?? unitCosts[row.item.id],
        },
        ctx,
      ),
    }));
  }, [counted, batches, draft, unitCosts]);

  const shrink = preview.filter((p) => !p.result.isOpening && p.result.varianceValue < 0).reduce((s, p) => s + p.result.varianceValue, 0);
  const found = preview.filter((p) => !p.result.isOpening && p.result.varianceValue > 0).reduce((s, p) => s + p.result.varianceValue, 0);
  const opening = preview.filter((p) => p.result.isOpening).reduce((s, p) => s + p.result.varianceValue, 0);

  const post = () => {
    try {
      const lines = postCount(count.id);
      toast.success(`Posted ${lines.length} line${lines.length === 1 ? '' : 's'}. On hand now matches the shelf.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (reviewing) {
    return (
      <Flex direction="column" gap={4}>
        <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={3}>
          <StatTile label="Shrinkage" value={formatPesos(-shrink)} icon={ArrowDownRight} hint="Less on the shelf than recorded" />
          <StatTile label="Found" value={formatPesos(found)} icon={ArrowUpRight} hint="More on the shelf than recorded" />
          <StatTile label="Net variance" value={formatPesos(shrink + found)} icon={ClipboardCheck} hint={`${preview.length - preview.filter((p) => p.result.isOpening).length} items compared`} />
          <StatTile label="Opening balances" value={formatPesos(opening)} icon={PackageCheck} hint="First count — not variance" />
        </SimpleGrid>
        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
          <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
            <Box>
              <Heading size="sm">Review before posting</Heading>
              <Text fontSize="xs" color={muted}>
                Shrinkage is valued at the batches it comes out of; found stock at the item's current cost.
              </Text>
            </Box>
            <Flex gap={2}>
              <Button variant="ghost" onClick={() => setReviewing(false)}>
                Back to counting
              </Button>
              <Button onClick={post} isDisabled={counted.length === 0}>
                Post count
              </Button>
            </Flex>
          </Flex>
          {scoped.length > counted.length && (
            <Alert status="warning" borderRadius="8px" fontSize="sm" mb={4}>
              <AlertIcon />
              {scoped.length - counted.length} item{scoped.length - counted.length === 1 ? ' was' : 's were'} not
              counted and will be left as they are. A blank is never read as zero.
            </Alert>
          )}
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Item</Th>
                  <Th>Expected</Th>
                  <Th>Counted</Th>
                  <Th isNumeric>Difference</Th>
                  <Th isNumeric>Value</Th>
                </Tr>
              </Thead>
              <Tbody>
                {[...preview]
                  .sort((a, b) => Math.abs(b.result.varianceValue) - Math.abs(a.result.varianceValue))
                  .map(({ row, result }) => (
                    <Tr key={row.item.id}>
                      <Td fontWeight="500">{row.item.name}</Td>
                      <Td className="numeric" fontSize="xs" color={muted}>
                        {result.isOpening ? '—' : formatStock(result.expectedQty, row.item)}
                      </Td>
                      <Td className="numeric" fontSize="xs">
                        {formatStock(result.countedQty, row.item)}
                      </Td>
                      <Td className="numeric" isNumeric fontSize="xs">
                        {result.isOpening ? (
                          <Badge fontSize="9px">opening</Badge>
                        ) : result.varianceQty === 0 ? (
                          <Text color={muted}>exact</Text>
                        ) : (
                          `${result.varianceQty > 0 ? '+' : '−'}${formatQty(Math.abs(result.varianceQty), row.item.baseUnit)}`
                        )}
                      </Td>
                      <Td
                        className="numeric"
                        isNumeric
                        fontWeight="600"
                        color={result.isOpening || result.varianceValue === 0 ? undefined : result.varianceValue < 0 ? 'margin.bad' : 'margin.good'}
                      >
                        {formatPesos(result.varianceValue)}
                      </Td>
                    </Tr>
                  ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      </Flex>
    );
  }

  let lastCategory = '';

  return (
    <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
      <Flex justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="sm">
            {count.note ?? 'Stock count'}{' '}
            <Text as="span" fontWeight="400" color={muted} fontSize="sm">
              · started {formatDateTime(count.startedAt)}
            </Text>
          </Heading>
          <Text fontSize="xs" color={muted}>
            {counted.length} of {scoped.length} counted. Leave an item blank to skip it; enter 0 if the shelf is empty.
          </Text>
        </Box>
        <Flex gap={2}>
          <Button
            variant="ghost"
            colorScheme="red"
            onClick={() => {
              cancelCount(count.id);
              toast('Count cancelled — nothing was posted');
            }}
          >
            Cancel count
          </Button>
          <Button onClick={() => setReviewing(true)} isDisabled={counted.length === 0}>
            Review {counted.length > 0 ? `(${counted.length})` : ''}
          </Button>
        </Flex>
      </Flex>

      <InputGroup size="sm" maxW="260px" mb={3}>
        <InputLeftElement pointerEvents="none" color={muted}>
          <Search size={14} />
        </InputLeftElement>
        <Input placeholder="Find an item" value={search} onChange={(e) => setSearch(e.target.value)} />
      </InputGroup>

      <Table size="sm">
        <Tbody>
          {visible.map((row) => {
            const entry = entries[row.item.id] ?? { sealed: '', loose: '' };
            const done = draft[row.item.id] !== undefined;
            const header = row.item.category !== lastCategory;
            lastCategory = row.item.category;
            return [
              header && (
                <Tr key={`h-${row.item.category}`}>
                  <Td colSpan={3} pt={4} fontSize="10px" fontWeight="700" letterSpacing="0.06em" color={muted}>
                    {row.item.category.toUpperCase()}
                  </Td>
                </Tr>
              ),
              <Tr key={row.item.id} bg={done ? doneBg : undefined}>
                <Td>
                  <Text fontWeight="500">{row.item.name}</Text>
                  <Text fontSize="xs" color={muted}>
                    {splits(row.item)
                      ? `${plural(row.item.purchaseUnit, 1)} of ${formatQty(row.item.packSize, row.item.baseUnit)}`
                      : `counted in ${row.item.baseUnit === 'each' ? 'pieces' : row.item.baseUnit}`}
                  </Text>
                </Td>
                <Td>
                  <Flex gap={2} align="center" justify="flex-end" wrap="wrap">
                    {splits(row.item) && (
                      <InputGroup size="sm" w="170px">
                        <Input className="numeric" type="number" min={0} value={entry.sealed} placeholder="—" textAlign="right" onChange={(e) => enter(row, { sealed: e.target.value })} />
                        <InputRightAddon fontSize="xs" w="82px">
                          {plural(row.item.purchaseUnit, 2).toLowerCase()}
                        </InputRightAddon>
                      </InputGroup>
                    )}
                    {splits(row.item) && (
                      <Text fontSize="xs" color={muted}>
                        +
                      </Text>
                    )}
                    <InputGroup size="sm" w="170px">
                      <Input className="numeric" type="number" min={0} value={entry.loose} placeholder="—" textAlign="right" onChange={(e) => enter(row, { loose: e.target.value })} />
                      <InputRightAddon fontSize="xs" w="82px">
                        {splits(row.item) ? `${row.item.baseUnit} open` : row.item.baseUnit}
                      </InputRightAddon>
                    </InputGroup>
                  </Flex>
                </Td>
                <Td w="40px">
                  {done && (
                    <IconButton
                      aria-label={`Clear ${row.item.name}`}
                      icon={<X size={14} />}
                      size="xs"
                      variant="ghost"
                      onClick={() => enter(row, { sealed: '', loose: '' })}
                    />
                  )}
                </Td>
              </Tr>,
            ];
          })}
        </Tbody>
      </Table>
    </Box>
  );
}

function CountHistory() {
  const { counts, countLines } = useInventoryStore();
  const items = useCatalogStore((s) => s.items);
  const [selected, setSelected] = useState<string | null>(null);
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const hoverBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.50');

  const completed = counts
    .filter((c) => c.status === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  if (completed.length === 0) return null;

  const totals = (lines: StockCountLine[]) => ({
    shrink: lines.filter((l) => !l.isOpening && l.varianceValue < 0).reduce((s, l) => s + l.varianceValue, 0),
    found: lines.filter((l) => !l.isOpening && l.varianceValue > 0).reduce((s, l) => s + l.varianceValue, 0),
    opening: lines.filter((l) => l.isOpening).reduce((s, l) => s + l.varianceValue, 0),
  });

  const detail = countLines
    .filter((l) => l.countId === selected)
    .sort((a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue));

  return (
    <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
      <Heading size="sm" mb={4}>
        Past counts
      </Heading>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Posted</Th>
            <Th>Note</Th>
            <Th isNumeric>Items</Th>
            <Th isNumeric>Shrinkage</Th>
            <Th isNumeric>Found</Th>
            <Th isNumeric>Opening</Th>
          </Tr>
        </Thead>
        <Tbody>
          {completed.map((c) => {
            const lines = countLines.filter((l) => l.countId === c.id);
            const t = totals(lines);
            return (
              <Tr key={c.id} cursor="pointer" _hover={{ bg: hoverBg }} bg={selected === c.id ? hoverBg : undefined} onClick={() => setSelected(selected === c.id ? null : c.id)}>
                <Td fontSize="xs">{c.completedAt ? formatDateTime(c.completedAt) : '—'}</Td>
                <Td fontSize="xs" color={muted}>
                  {c.note ?? '—'}
                </Td>
                <Td className="numeric" isNumeric>
                  {lines.length}
                </Td>
                <Td className="numeric" isNumeric color={t.shrink < 0 ? 'margin.bad' : muted}>
                  {formatPesos(t.shrink)}
                </Td>
                <Td className="numeric" isNumeric color={t.found > 0 ? 'margin.good' : muted}>
                  {formatPesos(t.found)}
                </Td>
                <Td className="numeric" isNumeric color={muted}>
                  {formatPesos(t.opening)}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>

      {selected && (
        <Box mt={4} pt={4} borderTop="1px solid" borderColor={border}>
          <Text fontSize="xs" fontWeight="700" letterSpacing="0.06em" color={muted} mb={2}>
            LINES · {formatDate(completed.find((c) => c.id === selected)?.completedAt ?? '', true).toUpperCase()}
          </Text>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Item</Th>
                <Th>Expected</Th>
                <Th>Counted</Th>
                <Th isNumeric>Value</Th>
              </Tr>
            </Thead>
            <Tbody>
              {detail.map((l) => {
                const item = items.find((i) => i.id === l.itemId);
                return (
                  <Tr key={l.id}>
                    <Td>{item?.name}</Td>
                    <Td className="numeric" fontSize="xs" color={muted}>
                      {l.isOpening ? '—' : item ? formatStock(l.expectedQty, item) : l.expectedQty}
                    </Td>
                    <Td className="numeric" fontSize="xs">
                      {item ? formatStock(l.countedQty, item) : l.countedQty}
                      {l.isOpening && (
                        <Badge ml={2} fontSize="9px">
                          opening
                        </Badge>
                      )}
                    </Td>
                    <Td className="numeric" isNumeric color={l.isOpening || l.varianceValue === 0 ? undefined : l.varianceValue < 0 ? 'margin.bad' : 'margin.good'}>
                      {formatPesos(l.varianceValue)}
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
