import { toCentavos, type Centavos } from '@digita/core';

/**
 * A size suffix only earns its place when there is something to tell apart —
 * the same rule as the admin's variantLabel, so "Cheesecake Slice" never reads
 * "Cheesecake Slice Slice" on a receipt.
 */
export function lineLabel(productName: string, size: string, siblingCount: number): string {
  return siblingCount > 1 ? `${productName} ${size}` : productName;
}

/** What a cashier typed ("257.14", "1,000") in centavos, or null if it is not an amount. */
export function parsePesos(input: string): Centavos | null {
  const cleaned = input.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return toCentavos(Number(cleaned));
}

/** Centavos back to the plain text an amount field shows: 25714 -> "257.14", 30000 -> "300". */
export function pesosText(amount: Centavos): string {
  return amount % 100 === 0 ? String(amount / 100) : (amount / 100).toFixed(2);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
