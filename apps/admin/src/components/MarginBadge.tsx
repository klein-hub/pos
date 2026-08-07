import { Badge } from '@chakra-ui/react';

interface MarginBadgeProps {
  marginPct: number;
  targetPct?: number;
}

/**
 * One consistent reading of margin health across every screen: below target is
 * red, within 5 points of target is amber, comfortably above is green. Using
 * the same rule everywhere means a colour always carries the same meaning.
 */
export function MarginBadge({ marginPct, targetPct = 70 }: MarginBadgeProps) {
  const scheme = marginPct < targetPct ? 'red' : marginPct < targetPct + 5 ? 'orange' : 'green';

  return (
    <Badge className="numeric" colorScheme={scheme} borderRadius="6px" px={2} py={0.5} fontSize="xs">
      {marginPct.toFixed(1)}%
    </Badge>
  );
}
