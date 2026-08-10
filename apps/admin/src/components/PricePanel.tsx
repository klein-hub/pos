import {
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { Sparkles } from 'lucide-react';
import {
  extractVat,
  formatPeso,
  margin,
  roundToMenuPrice,
  suggestedPrice,
  toCentavos,
  toPesos,
  type ProductVariant,
} from '@digita/core';
import { MarginBadge } from './MarginBadge';

interface PricePanelProps {
  variant: ProductVariant;
  cost: number;
  onPriceChange: (price: number) => void;
  onTargetChange: (targetPct: number) => void;
}

/**
 * Price-led, per the brief: you type what the drink sells for and the panel
 * answers with cost, VAT and margin. The suggestion is offered, never applied
 * automatically — menu prices are round numbers set by the market, not by a
 * formula, and overriding it is the normal case rather than the exception.
 */
export function PricePanel({ variant, cost, onPriceChange, onTargetChange }: PricePanelProps) {
  const target = variant.targetMarginPct ?? 70;
  const result = margin(variant.sellingPrice, cost, target);
  const { vat } = extractVat(variant.sellingPrice);

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const railBg = useColorModeValue('blackAlpha.100', 'whiteAlpha.200');

  const suggestion = cost > 0 ? roundToMenuPrice(suggestedPrice(cost, target)) : 0;
  const marginColor = result.belowTarget
    ? 'margin.bad'
    : result.marginPct < target + 5
      ? 'margin.watch'
      : 'margin.good';

  return (
    <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5}>
      <Text fontSize="xs" fontWeight="700" letterSpacing="0.06em" color={muted} mb={3}>
        PRICE &amp; MARGIN
      </Text>

      <Flex align="flex-end" gap={3} mb={4}>
        <Box flex="1">
          <Text fontSize="xs" color={muted} mb={1}>
            Selling price (VAT-inclusive)
          </Text>
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none" color={muted}>
              ₱
            </InputLeftElement>
            <Input
              className="numeric"
              type="number"
              step={5}
              min={0}
              value={toPesos(variant.sellingPrice)}
              onChange={(e) => onPriceChange(toCentavos(Number(e.target.value)))}
              fontWeight="700"
            />
          </InputGroup>
        </Box>
        {/* Only an action when it would *raise* the price. Above target the
            suggestion is information — a prominent button showing a lower
            number is an invitation to destroy margin by mis-click. */}
        <Tooltip
          label={
            result.belowTarget
              ? `Set the price that hits ${target}% margin, rounded up to the nearest ₱5`
              : `${target}% margin would only need ${formatPeso(suggestion)} — you are already above target`
          }
          openDelay={200}
        >
          <Button
            leftIcon={<Sparkles size={16} />}
            variant={result.belowTarget ? 'solid' : 'ghost'}
            size="lg"
            color={result.belowTarget ? undefined : muted}
            fontWeight={result.belowTarget ? '600' : '400'}
            isDisabled={cost <= 0 || suggestion === variant.sellingPrice}
            onClick={() => onPriceChange(suggestion)}
          >
            {result.belowTarget ? `Set ${formatPeso(suggestion)}` : `${target}% at ${formatPeso(suggestion)}`}
          </Button>
        </Tooltip>
      </Flex>

      {/* Where the money actually goes: VAT out first, then cost, then profit. */}
      <Flex h="10px" borderRadius="5px" overflow="hidden" bg={railBg} mb={2}>
        <Box bg="gray.400" w={`${pct(vat, variant.sellingPrice)}%`} />
        <Box bg="primary.400" w={`${pct(toCentavos(cost), variant.sellingPrice)}%`} />
        <Box bg={marginColor} flex="1" />
      </Flex>
      <HStack spacing={4} mb={4} fontSize="xs" color={muted}>
        <Legend color="gray.400" label="VAT" value={formatPeso(vat)} />
        <Legend color="primary.400" label="Cost" value={`₱${cost.toFixed(2)}`} />
        <Legend color={marginColor} label="Profit" value={`₱${result.grossProfit.toFixed(2)}`} />
      </HStack>

      <Divider borderColor={border} mb={4} />

      <Flex gap={6} wrap="wrap">
        <Stat flex="0 0 auto">
          <StatLabel fontSize="xs" color={muted}>
            Net of VAT
          </StatLabel>
          <StatNumber className="numeric" fontSize="lg">
            ₱{result.netPrice.toFixed(2)}
          </StatNumber>
        </Stat>
        <Stat flex="0 0 auto">
          <StatLabel fontSize="xs" color={muted}>
            Margin
          </StatLabel>
          <StatNumber fontSize="lg">
            <MarginBadge marginPct={result.marginPct} targetPct={target} />
          </StatNumber>
        </Stat>
        <Stat flex="0 0 auto">
          <StatLabel fontSize="xs" color={muted}>
            Markup
          </StatLabel>
          <StatNumber className="numeric" fontSize="lg">
            {result.markupPct.toFixed(0)}%
          </StatNumber>
        </Stat>
        <Box>
          <Text fontSize="xs" color={muted} mb={1}>
            Target margin
          </Text>
          <InputGroup size="sm" w="90px">
            <Input
              className="numeric"
              type="number"
              min={0}
              max={99}
              value={target}
              onChange={(e) => onTargetChange(Number(e.target.value))}
              textAlign="right"
              pr={6}
            />
            <InputLeftElement pointerEvents="none" left="auto" right={0} color={muted} fontSize="xs">
              %
            </InputLeftElement>
          </InputGroup>
        </Box>
      </Flex>

      {result.belowTarget && (
        <Text fontSize="xs" color="margin.bad" mt={3} fontWeight="600">
          {(target - result.marginPct).toFixed(1)} points under target. Raising the price to{' '}
          {formatPeso(suggestion)} would close the gap.
        </Text>
      )}
    </Box>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <Flex align="center" gap={1.5}>
      <Box w="8px" h="8px" borderRadius="2px" bg={color} />
      <Text>
        {label} <Text as="span" className="numeric" fontWeight="600">{value}</Text>
      </Text>
    </Flex>
  );
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0;
}
