import { useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Divider,
  Flex,
  Grid,
  Heading,
  Select,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { recipeCost, type RecipeLine } from '@digita/core';
import { CostBreakdown } from '../components/CostBreakdown';
import { PricePanel } from '../components/PricePanel';
import { variantLabel } from '../lib/labels';
import { useCatalogStore, useCostingContext } from '../store/catalogStore';

export function Recipes() {
  const {
    items,
    products,
    variants,
    recipeLines,
    notes,
    setPrice,
    setTargetMargin,
    setLineQty,
    addLine,
    removeLine,
  } = useCatalogStore();
  const ctx = useCostingContext();

  const [selectedId, setSelectedId] = useState<string>(variants[0]?.id ?? '');
  const [addItemId, setAddItemId] = useState<string>('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const activeBg = useColorModeValue('primary.50', 'whiteAlpha.200');
  const hoverBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');

  const prepItems = useMemo(() => items.filter((i) => i.itemType === 'sub_assembly'), [items]);
  const variant = variants.find((v) => v.id === selectedId);
  const prep = prepItems.find((i) => i.id === selectedId);

  const breakdown = useMemo(
    () => (selectedId ? recipeCost(selectedId, ctx) : null),
    // recipeLines and unitCosts drive the roll-up; ctx is rebuilt from them.
    [selectedId, recipeLines, ctx],
  );

  const lineIdByItem = useMemo(() => {
    const map: Record<string, string> = {};
    for (const line of recipeLines.filter((l: RecipeLine) => l.ownerId === selectedId)) {
      map[line.itemId] = line.id;
    }
    return map;
  }, [recipeLines, selectedId]);

  const ownerType: RecipeLine['ownerType'] = prep ? 'prep' : 'variant';
  const title = variant
    ? variantLabel(
        products.find((p) => p.id === variant.productId)?.name ?? '',
        variant.size,
        variants.filter((v) => v.productId === variant.productId).length,
      )
    : (prep?.name ?? '');

  const grouped = useMemo(() => {
    return products.map((product) => ({
      product,
      variants: variants.filter((v) => v.productId === product.id),
    }));
  }, [products, variants]);

  return (
    <Grid templateColumns={{ base: '1fr', lg: '280px 1fr' }} gap={4} alignItems="start">
      <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={3}>
        <Text fontSize="xs" fontWeight="700" letterSpacing="0.06em" color={muted} px={2} py={2}>
          PRODUCTS
        </Text>
        {grouped.map(({ product, variants: vs }) => (
          <Box key={product.id} mb={2}>
            <Text fontSize="sm" fontWeight="600" px={2} py={1}>
              {product.name}
            </Text>
            {vs.map((v) => (
              <Flex
                key={v.id}
                px={2}
                py={1.5}
                ml={2}
                borderRadius="6px"
                cursor="pointer"
                bg={v.id === selectedId ? activeBg : 'transparent'}
                _hover={{ bg: v.id === selectedId ? activeBg : hoverBg }}
                onClick={() => setSelectedId(v.id)}
                justify="space-between"
                align="center"
              >
                <Text fontSize="sm">{v.size}</Text>
              </Flex>
            ))}
          </Box>
        ))}

        <Divider borderColor={border} my={2} />
        <Text fontSize="xs" fontWeight="700" letterSpacing="0.06em" color={muted} px={2} py={2}>
          PREP ITEMS
        </Text>
        {prepItems.map((item) => (
          <Flex
            key={item.id}
            px={2}
            py={1.5}
            borderRadius="6px"
            cursor="pointer"
            bg={item.id === selectedId ? activeBg : 'transparent'}
            _hover={{ bg: item.id === selectedId ? activeBg : hoverBg }}
            onClick={() => setSelectedId(item.id)}
            justify="space-between"
            align="center"
          >
            <Text fontSize="sm">{item.name}</Text>
            <Badge fontSize="10px" colorScheme="orange" borderRadius="4px">
              /{item.prepYieldQty} {item.baseUnit}
            </Badge>
          </Flex>
        ))}
      </Box>

      <Flex direction="column" gap={4}>
        <Alert status="info" borderRadius="10px" fontSize="sm">
          <AlertIcon />
          Ingredient costs are your real price list. The recipe quantities are starter
          assumptions — adjust each to your actual build.
        </Alert>

        {breakdown && (
          <>
            <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
              <Flex justify="space-between" align="baseline" mb={1} wrap="wrap" gap={2}>
                <Heading size="sm">{title}</Heading>
                <Text className="numeric" fontSize="xl" fontWeight="700">
                  ₱{breakdown.total.toFixed(2)}
                  {prep && (
                    <Text as="span" fontSize="sm" fontWeight="400" color={muted}>
                      {' '}
                      per batch · ₱{(breakdown.total / (prep.prepYieldQty || 1)).toFixed(2)} per{' '}
                      {prep.baseUnit === 'each' ? 'serving' : prep.baseUnit}
                    </Text>
                  )}
                </Text>
              </Flex>
              {notes[selectedId] && (
                <Text fontSize="xs" color={muted} mb={4}>
                  {notes[selectedId]}
                </Text>
              )}

              {breakdown.warnings.length > 0 && (
                <Alert status="warning" borderRadius="8px" fontSize="xs" mb={4}>
                  <AlertIcon />
                  <Box>
                    {breakdown.warnings.map((w) => (
                      <Text key={w}>{w}</Text>
                    ))}
                  </Box>
                </Alert>
              )}

              <Box overflowX="auto">
                <CostBreakdown
                  breakdown={breakdown}
                  lineIdByItem={lineIdByItem}
                  onQtyChange={setLineQty}
                  onRemove={removeLine}
                />
              </Box>

              <Flex gap={2} mt={4} align="center">
                <Select
                  size="sm"
                  maxW="320px"
                  placeholder="Add an ingredient…"
                  value={addItemId}
                  onChange={(e) => {
                    if (e.target.value) {
                      addLine(selectedId, ownerType, e.target.value);
                      setAddItemId('');
                    }
                  }}
                >
                  {items
                    .filter((i) => i.id !== selectedId && !lineIdByItem[i.id])
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.baseUnit})
                      </option>
                    ))}
                </Select>
                <Text fontSize="xs" color={muted}>
                  New lines start at 1 {'—'} set the quantity in the table.
                </Text>
              </Flex>
            </Box>

            {variant && (
              <PricePanel
                variant={variant}
                cost={breakdown.total}
                onPriceChange={(price) => setPrice(variant.id, price)}
                onTargetChange={(target) => setTargetMargin(variant.id, target)}
              />
            )}
          </>
        )}
      </Flex>
    </Grid>
  );
}
