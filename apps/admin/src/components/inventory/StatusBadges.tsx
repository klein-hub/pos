import { Badge, Tooltip } from '@chakra-ui/react';
import { daysUntil, type ExpiryStatus } from '@digita/core';
import { EXPIRY_META, STATUS_META, formatDate, type StockRow } from '../../lib/inventory';

export function StockStatusBadge({ row }: { row: StockRow }) {
  const meta = STATUS_META[row.status];
  const reason =
    row.status === 'untracked'
      ? 'No stock has been recorded yet. Run an opening count or receive a delivery.'
      : (row.reorder?.reason ?? (row.status === 'out' ? 'Out of stock.' : 'Set a par level to get reorder advice.'));

  return (
    <Tooltip label={reason} openDelay={250} hasArrow>
      <Badge colorScheme={meta.scheme} borderRadius="6px" px={2} fontSize="10px">
        {meta.label}
      </Badge>
    </Tooltip>
  );
}

export function ExpiryBadge({ date, status }: { date: string; status: ExpiryStatus }) {
  const days = daysUntil(date);
  const label =
    status === 'expired'
      ? 'Expired'
      : days === 0
        ? 'Today'
        : status === 'ok'
          ? formatDate(date)
          : `${days} day${days === 1 ? '' : 's'}`;

  return (
    <Tooltip label={`Expires ${formatDate(date, true)}`} openDelay={250} hasArrow>
      <Badge
        className="numeric"
        colorScheme={EXPIRY_META[status].scheme}
        variant={status === 'ok' ? 'outline' : 'subtle'}
        borderRadius="6px"
        px={2}
        fontSize="10px"
      >
        {label}
      </Badge>
    </Tooltip>
  );
}
