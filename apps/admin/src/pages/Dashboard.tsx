import {
  Alert,
  AlertIcon,
  Badge,
  Box,
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
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { Coins, Percent, Receipt, Trash2, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DATA_MODE_INFO, formatPeso } from '@digita/core';
import { MarginBadge } from '../components/MarginBadge';
import { StatTile } from '../components/StatTile';
import { useCatalogStore } from '../store/catalogStore';
import { productMargins, salesByHour, stockAlerts, todayTotals } from '../data/demoData';

const STATUS_LABEL: Record<string, { text: string; scheme: string }> = {
  out: { text: 'Out of stock', scheme: 'red' },
  critical: { text: 'Critical', scheme: 'red' },
  below_par: { text: 'Below par', scheme: 'orange' },
};

export function Dashboard() {
  const source = useCatalogStore((s) => s.source);
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const gridStroke = useColorModeValue('#e8e4df', '#2d3748');

  const topProducts = [...productMargins].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 6);
  const belowTarget = productMargins.filter((p) => p.belowTarget);

  return (
    <Flex direction="column" gap={6}>
      {/* Deliberately specific about scope. The header badge reports where the
          CATALOG is loaded from, which can legitimately say "Live" while this
          page is still entirely sample data — sales are not recorded anywhere
          yet. Saying only "showing demo figures" next to a Live badge reads as
          a contradiction and leaves the reader to work out which to believe. */}
      <Alert status="warning" borderRadius="10px" fontSize="sm" alignItems="flex-start">
        <AlertIcon />
        <Box>
          <Text fontWeight="600">Every figure on this page is sample data</Text>
          <Text fontSize="xs">
            Nothing records sales yet, so these totals, charts and stock alerts are invented —
            including the costs and margins. The {DATA_MODE_INFO[source].label.toLowerCase()} badge
            above refers to the catalog, which Menu &amp; Margins, Recipes and Inventory do read
            for real.
          </Text>
        </Box>
      </Alert>

      <SimpleGrid columns={{ base: 1, sm: 2, xl: 5 }} spacing={4}>
        <StatTile label="Sales today" value={formatPeso(todayTotals.sales)} icon={Coins} delta={8.4} />
        <StatTile
          label="Transactions"
          value={String(todayTotals.transactions)}
          icon={Receipt}
          delta={5.1}
        />
        <StatTile
          label="Average ticket"
          value={formatPeso(todayTotals.averageTicket)}
          icon={TrendingUp}
          delta={3.2}
        />
        <StatTile
          label="Gross margin"
          value={`${todayTotals.grossMarginPct.toFixed(1)}%`}
          icon={Percent}
          delta={-1.4}
          hint="VAT-exclusive"
        />
        <StatTile
          label="Waste today"
          value={formatPeso(todayTotals.wasteCost)}
          icon={Trash2}
          delta={12.6}
          invertDelta
        />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={4}>
        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
          <Heading size="sm" mb={1}>
            Sales by hour
          </Heading>
          <Text fontSize="xs" color={muted} mb={4}>
            Two clear peaks — the morning rush and the 3–5pm afternoon run.
          </Text>
          <Box h="260px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByHour} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b58555" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#b58555" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => `₱${Math.round(v / 100)}`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={56}
                />
                <RechartsTooltip
                  formatter={(v) => formatPeso(Number(v))}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none' }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#946231"
                  strokeWidth={2}
                  fill="url(#salesFill)"
                  // A dashboard that refreshes through the day should not
                  // replay a sweep animation every time the data updates.
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
          <Heading size="sm" mb={1}>
            Needs ordering
          </Heading>
          <Text fontSize="xs" color={muted} mb={4}>
            Ranked by how soon you run out, against supplier lead time.
          </Text>
          <Flex direction="column" gap={3}>
            {stockAlerts.map((alert) => {
              const label = STATUS_LABEL[alert.status];
              return (
                <Box key={alert.itemId} borderBottom="1px solid" borderColor={border} pb={3}>
                  <Flex align="center" justify="space-between" mb={1}>
                    <Text fontSize="sm" fontWeight="600">
                      {alert.name}
                    </Text>
                    <Badge colorScheme={label?.scheme} borderRadius="6px" fontSize="10px">
                      {label?.text}
                    </Badge>
                  </Flex>
                  <Text className="numeric" fontSize="xs" color={muted}>
                    {alert.onHandLabel} on hand ·{' '}
                    {alert.daysOfCover === 0
                      ? 'no cover'
                      : `${alert.daysOfCover} days cover, ${alert.leadTimeDays} day lead`}
                  </Text>
                  {alert.orderPurchaseUnits > 0 && (
                    <Text fontSize="xs" fontWeight="600" color="primary.600" mt={1}>
                      Order {alert.orderPurchaseUnits} {alert.purchaseUnit}
                      {alert.orderPurchaseUnits === 1 ? '' : 's'}
                    </Text>
                  )}
                </Box>
              );
            })}
          </Flex>
        </Box>
      </Grid>

      {belowTarget.length > 0 && (
        <Alert status="warning" borderRadius="10px" fontSize="sm">
          <AlertIcon />
          {belowTarget.length} item{belowTarget.length === 1 ? '' : 's'} below the 70% target margin:{' '}
          {belowTarget.map((p) => p.name).join(', ')}.
        </Alert>
      )}

      <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
        <Heading size="sm" mb={1}>
          Top products by profit
        </Heading>
        <Text fontSize="xs" color={muted} mb={4}>
          Profit, not revenue — the drink that sells most is rarely the one that earns most.
        </Text>
        <Box overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Product</Th>
                <Th isNumeric>Sold</Th>
                <Th isNumeric>Price</Th>
                <Th isNumeric>Cost</Th>
                <Th isNumeric>Margin</Th>
                <Th isNumeric>Total profit</Th>
              </Tr>
            </Thead>
            <Tbody>
              {topProducts.map((p) => (
                <Tr key={p.variantId}>
                  <Td fontWeight="500">{p.name}</Td>
                  <Td className="numeric" isNumeric>
                    {p.unitsSold}
                  </Td>
                  <Td className="numeric" isNumeric>
                    {formatPeso(p.priceGross)}
                  </Td>
                  <Td className="numeric" isNumeric>
                    {formatPeso(Math.round(p.cost * 100))}
                  </Td>
                  <Td isNumeric>
                    <MarginBadge marginPct={p.marginPct} />
                  </Td>
                  <Td className="numeric" isNumeric fontWeight="600">
                    {formatPeso(Math.round(p.totalProfit * 100))}
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
