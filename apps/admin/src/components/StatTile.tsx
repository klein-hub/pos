import { Box, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Percentage change against the comparison period. Omit to hide the delta. */
  delta?: number;
  /** For costs and waste, a rise is bad — flips the delta colouring. */
  invertDelta?: boolean;
  hint?: string;
}

export function StatTile({ label, value, icon, delta, invertDelta, hint }: StatTileProps) {
  const bg = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  const rising = (delta ?? 0) >= 0;
  const good = invertDelta ? !rising : rising;
  const deltaColor = delta === undefined ? muted : good ? 'margin.good' : 'margin.bad';

  return (
    <Box bg={bg} borderRadius="12px" border="1px solid" borderColor={border} p={5}>
      <Flex align="center" justify="space-between" mb={3}>
        <Text fontSize="xs" fontWeight="600" letterSpacing="0.04em" color={muted}>
          {label.toUpperCase()}
        </Text>
        <Icon as={icon} boxSize={4} color={muted} />
      </Flex>
      <Text className="numeric" fontSize="2xl" fontWeight="700" lineHeight="1.1">
        {value}
      </Text>
      <Flex align="center" gap={1} mt={2} minH="18px">
        {delta !== undefined && (
          <>
            <Icon as={rising ? ArrowUpRight : ArrowDownRight} boxSize={3.5} color={deltaColor} />
            <Text className="numeric" fontSize="xs" fontWeight="600" color={deltaColor}>
              {Math.abs(delta).toFixed(1)}%
            </Text>
          </>
        )}
        {hint && (
          <Text fontSize="xs" color={muted} noOfLines={1}>
            {hint}
          </Text>
        )}
      </Flex>
    </Box>
  );
}
