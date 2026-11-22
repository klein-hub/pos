import { useMemo } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Flex,
  Grid,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
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
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  classifyMenu,
  formatPeso,
  margin,
  recipeCost,
  toCentavos,
  toPesos,
  type MenuQuadrant,
} from '@digita/core';
import { MarginBadge } from '../components/MarginBadge';
import { variantLabel } from '../lib/labels';
import { useCatalogStore } from '../store/catalogStore';
import { useCostingContext } from '../store/selectors';

const QUADRANT_META: Record<MenuQuadrant, { label: string; color: string; scheme: string }> = {
  star: { label: 'Star', color: '#2f855a', scheme: 'green' },
  plowhorse: { label: 'Plowhorse', color: '#b7791f', scheme: 'orange' },
  puzzle: { label: 'Puzzle', color: '#2b6cb0', scheme: 'blue' },
  dog: { label: 'Dog', color: '#c53030', scheme: 'red' },
};

export function MenuMargins() {
  const { products, variants, recipeLines, volumes, setPrice } = useCatalogStore();
  const ctx = useCostingContext();

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const gridStroke = useColorModeValue('#e8e4df', '#2d3748');

  const rows = useMemo(() => {
    return variants.map((variant) => {
      const product = products.find((p) => p.id === variant.productId);
      const siblings = variants.filter((v) => v.productId === variant.productId).length;
      const breakdown = recipeCost(variant.id, ctx);
      const target = variant.targetMarginPct ?? 70;
      const result = margin(variant.sellingPrice, breakdown.total, target);
      return {
        ...result,
        variant,
        name: variantLabel(product?.name ?? '', variant.size, siblings),
        category: product?.category ?? '',
        warnings: breakdown.warnings,
        unitsSold: volumes[variant.id] ?? 0,
        target,
      };
    });
  }, [variants, products, recipeLines, volumes, ctx]);

  const classified = useMemo(
    () =>
      classifyMenu(
        rows.map((r) => ({
          variantId: r.variant.id,
          name: r.name,
          unitsSold: r.unitsSold,
          unitProfit: r.grossProfit,
        })),
      ),
    [rows],
  );

  const quadrantOf = useMemo(
    () => Object.fromEntries(classified.map((c) => [c.variantId, c])),
    [classified],
  );

  const belowTarget = rows.filter((r) => r.belowTarget);
  const totalUnits = rows.reduce((sum, r) => sum + r.unitsSold, 0);
  const weightedProfit =
    totalUnits > 0 ? rows.reduce((s, r) => s + r.grossProfit * r.unitsSold, 0) / totalUnits : 0;
  const popularityCutoff = rows.length > 0 ? (totalUnits / rows.length) * 0.7 : 0;

  const scatterData = rows.map((r) => ({
    x: r.unitsSold,
    y: r.grossProfit,
    z: r.grossProfit * r.unitsSold,
    name: r.name,
    quadrant: quadrantOf[r.variant.id]?.quadrant ?? 'dog',
  }));

  const counts = classified.reduce<Record<string, number>>((acc, c) => {
    acc[c.quadrant] = (acc[c.quadrant] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Flex direction="column" gap={4}>
      {belowTarget.length > 0 && (
        <Alert status="warning" borderRadius="10px" fontSize="sm">
          <AlertIcon />
          {belowTarget.length} item{belowTarget.length === 1 ? '' : 's'} below target margin:{' '}
          {belowTarget.map((r) => `${r.name} (${r.marginPct.toFixed(1)}%)`).join(', ')}.
        </Alert>
      )}

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        {(Object.keys(QUADRANT_META) as MenuQuadrant[]).map((q) => (
          <Box
            key={q}
            bg={cardBg}
            border="1px solid"
            borderColor={border}
            borderRadius="10px"
            p={4}
            borderLeftWidth="4px"
            borderLeftColor={QUADRANT_META[q].color}
          >
            <Text fontSize="xs" color={muted} fontWeight="600">
              {QUADRANT_META[q].label.toUpperCase()}S
            </Text>
            <Text className="numeric" fontSize="2xl" fontWeight="700">
              {counts[q] ?? 0}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
          <Heading size="sm" mb={1}>
            Menu engineering
          </Heading>
          <Text fontSize="xs" color={muted} mb={4}>
            Profit per unit against volume. The crosshair is the sales-weighted average
            profit and 70% of an even share of volume.
          </Text>
          <Box h="320px">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: -8 }}>
                <CartesianGrid stroke={gridStroke} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Units sold"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  label={{ value: 'Units sold', position: 'insideBottom', offset: -8, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Profit per unit"
                  tickFormatter={(v: number) => `₱${v.toFixed(0)}`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={56}
                />
                <ZAxis type="number" dataKey="z" range={[60, 420]} />
                <ReferenceLine x={popularityCutoff} stroke={gridStroke} strokeDasharray="4 4" />
                <ReferenceLine y={weightedProfit} stroke={gridStroke} strokeDasharray="4 4" />
                <RechartsTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none' }}
                  content={({ payload }) => {
                    const point = payload?.[0]?.payload as (typeof scatterData)[number] | undefined;
                    if (!point) return null;
                    return (
                      <Box bg={cardBg} borderRadius="8px" px={3} py={2} boxShadow="lg" fontSize="xs">
                        <Text fontWeight="600">{point.name}</Text>
                        <Text color={muted}>
                          {point.x} sold · ₱{point.y.toFixed(2)} each
                        </Text>
                        <Badge
                          mt={1}
                          fontSize="10px"
                          colorScheme={QUADRANT_META[point.quadrant as MenuQuadrant].scheme}
                        >
                          {QUADRANT_META[point.quadrant as MenuQuadrant].label}
                        </Badge>
                      </Box>
                    );
                  }}
                />
                <Scatter data={scatterData} isAnimationActive={false}>
                  {scatterData.map((point) => (
                    <Cell
                      key={point.name}
                      fill={QUADRANT_META[point.quadrant as MenuQuadrant].color}
                      fillOpacity={0.75}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
          <Heading size="sm" mb={1}>
            What to do about each
          </Heading>
          <Text fontSize="xs" color={muted} mb={4}>
            Ranked by total profit contribution over the trailing four weeks.
          </Text>
          <Flex direction="column" gap={3} maxH="320px" overflowY="auto" pr={1}>
            {[...classified]
              .sort((a, b) => b.totalProfit - a.totalProfit)
              .map((c) => (
                <Box key={c.variantId} borderBottom="1px solid" borderColor={border} pb={2}>
                  <Flex justify="space-between" align="center" gap={2}>
                    <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                      {c.name}
                    </Text>
                    <Flex align="center" gap={2} flexShrink={0}>
                      <Text className="numeric" fontSize="xs" color={muted}>
                        {formatPeso(Math.round(c.totalProfit * 100))}
                      </Text>
                      <Badge fontSize="10px" colorScheme={QUADRANT_META[c.quadrant].scheme}>
                        {QUADRANT_META[c.quadrant].label}
                      </Badge>
                    </Flex>
                  </Flex>
                  <Text fontSize="xs" color={muted} mt={0.5}>
                    {c.advice}
                  </Text>
                </Box>
              ))}
          </Flex>
        </Box>
      </Grid>

      <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
        <Heading size="sm" mb={1}>
          Prices
        </Heading>
        <Text fontSize="xs" color={muted} mb={4}>
          Edit any price to see margin move. Costs come from your ingredient price list.
        </Text>
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th w="140px">Price</Th>
                <Th isNumeric>Cost</Th>
                <Th isNumeric>Net of VAT</Th>
                <Th isNumeric>Profit</Th>
                <Th isNumeric>Margin</Th>
                <Th isNumeric>Sold</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr key={row.variant.id}>
                  <Td fontWeight="500">
                    {row.name}
                    {row.warnings.length > 0 && (
                      <Badge ml={2} fontSize="10px" colorScheme="yellow">
                        {row.warnings.length} warning{row.warnings.length === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </Td>
                  <Td fontSize="xs" color={muted}>
                    {row.category}
                  </Td>
                  <Td>
                    <InputGroup size="sm">
                      <InputLeftElement pointerEvents="none" color={muted} fontSize="xs">
                        ₱
                      </InputLeftElement>
                      <Input
                        className="numeric"
                        type="number"
                        step={5}
                        min={0}
                        value={toPesos(row.variant.sellingPrice)}
                        onChange={(e) => setPrice(row.variant.id, toCentavos(Number(e.target.value)))}
                        textAlign="right"
                      />
                    </InputGroup>
                  </Td>
                  <Td className="numeric" isNumeric>
                    ₱{row.cost.toFixed(2)}
                  </Td>
                  <Td className="numeric" isNumeric color={muted}>
                    ₱{row.netPrice.toFixed(2)}
                  </Td>
                  <Td className="numeric" isNumeric fontWeight="600">
                    ₱{row.grossProfit.toFixed(2)}
                  </Td>
                  <Td isNumeric>
                    <MarginBadge marginPct={row.marginPct} targetPct={row.target} />
                  </Td>
                  <Td className="numeric" isNumeric color={muted}>
                    {row.unitsSold}
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
