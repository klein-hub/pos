import { Fragment } from 'react';
import {
  Box,
  Flex,
  IconButton,
  Input,
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
import { CornerDownRight, X } from 'lucide-react';
import { formatUnitCost, type CostBreakdown as Breakdown, type CostBreakdownLine } from '@digita/core';

interface CostBreakdownProps {
  breakdown: Breakdown;
  /** Line ids keyed by itemId, so an edit knows which recipe row to update. */
  lineIdByItem: Record<string, string>;
  onQtyChange: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
}

const peso = (v: number) => `₱${v.toFixed(2)}`;

export function CostBreakdown({
  breakdown,
  lineIdByItem,
  onQtyChange,
  onRemove,
}: CostBreakdownProps) {
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const barTrack = useColorModeValue('blackAlpha.100', 'whiteAlpha.200');

  return (
    <Table size="sm" variant="simple">
      <Thead>
        <Tr>
          <Th>Ingredient</Th>
          <Th w="130px">Qty</Th>
          <Th isNumeric>Unit cost</Th>
          <Th isNumeric>Cost</Th>
          <Th w="90px">Share</Th>
          <Th w="40px" />
        </Tr>
      </Thead>
      <Tbody>
        {breakdown.lines.map((line) => {
          const lineId = lineIdByItem[line.itemId];
          const share = breakdown.total > 0 ? line.cost / breakdown.total : 0;

          return (
            <Fragment key={line.itemId}>
              <Tr>
                <Td fontWeight="500">
                  {line.itemName}
                  {line.children && (
                    <Text as="span" fontSize="xs" color={muted} ml={2}>
                      prep item
                    </Text>
                  )}
                </Td>
                <Td>
                  <Flex align="center" gap={1}>
                    <Input
                      className="numeric"
                      size="sm"
                      type="number"
                      step={line.unit === 'each' ? 1 : 5}
                      min={0}
                      value={line.qty}
                      w="76px"
                      textAlign="right"
                      isDisabled={!lineId}
                      onChange={(e) => lineId && onQtyChange(lineId, Number(e.target.value))}
                    />
                    <Text fontSize="xs" color={muted}>
                      {line.unit}
                    </Text>
                  </Flex>
                </Td>
                <Td className="numeric" isNumeric fontSize="xs" color={muted}>
                  {formatUnitCost(line.unitCost, line.unit)}
                </Td>
                <Td className="numeric" isNumeric fontWeight="600">
                  {peso(line.cost)}
                </Td>
                <Td>
                  <Tooltip label={`${(share * 100).toFixed(1)}% of cost`} openDelay={200}>
                    <Box bg={barTrack} h="6px" borderRadius="3px" overflow="hidden">
                      <Box
                        bg="primary.400"
                        h="100%"
                        w={`${Math.min(100, share * 100)}%`}
                        transition="width 150ms ease"
                      />
                    </Box>
                  </Tooltip>
                </Td>
                <Td>
                  {lineId && (
                    <IconButton
                      aria-label={`Remove ${line.itemName}`}
                      icon={<X size={14} />}
                      size="xs"
                      variant="ghost"
                      onClick={() => onRemove(lineId)}
                    />
                  )}
                </Td>
              </Tr>
              {line.children?.map((child) => (
                <NestedRow key={`${line.itemId}-${child.itemId}`} line={child} />
              ))}
            </Fragment>
          );
        })}
      </Tbody>
    </Table>
  );
}

/** A sub-assembly's own ingredients, shown for transparency but edited on its
 *  own recipe — changing beans here would silently change every espresso drink. */
function NestedRow({ line }: { line: CostBreakdownLine }) {
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const nestedBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.50');

  return (
    <Tr bg={nestedBg}>
      <Td pl={8} fontSize="xs" color={muted}>
        <Flex align="center" gap={1}>
          <CornerDownRight size={12} />
          {line.itemName}
        </Flex>
      </Td>
      <Td className="numeric" fontSize="xs" color={muted}>
        {line.qty} {line.unit}
      </Td>
      <Td className="numeric" isNumeric fontSize="xs" color={muted}>
        {formatUnitCost(line.unitCost, line.unit)}
      </Td>
      <Td className="numeric" isNumeric fontSize="xs" color={muted}>
        {peso(line.cost)}
      </Td>
      <Td colSpan={2} />
    </Tr>
  );
}
