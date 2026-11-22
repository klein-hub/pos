import type { Centavos, Pesos } from '../types/units.js';

/** Unit costs are kept to 6dp — a gram of milk is a fraction of a centavo. */
export const UNIT_COST_PRECISION = 6;

export function roundUnitCost(value: Pesos): Pesos {
  const f = 10 ** UNIT_COST_PRECISION;
  return Math.round(value * f) / f;
}

/** Half-up to the centavo. The only rounding a customer ever sees. */
export function toCentavos(pesos: Pesos): Centavos {
  return Math.round(pesos * 100 + Number.EPSILON);
}

export function toPesos(centavos: Centavos): Pesos {
  return centavos / 100;
}

export function formatPeso(centavos: Centavos): string {
  const sign = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const whole = Math.floor(abs / 100).toLocaleString('en-PH');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}₱${whole}.${frac}`;
}

/**
 * Split an integer centavo amount across weights so the parts sum to the whole
 * exactly. Each part is floored, then the leftover centavos go to the largest
 * remainders — proportional rounding on its own drifts by a centavo or two,
 * and a receipt whose line VAT does not add up to its VAT line is a finding.
 */
export function allocateCentavos(total: Centavos, weights: readonly number[]): Centavos[] {
  if (!Number.isInteger(total)) {
    throw new Error(`Can only allocate whole centavos, got ${total}`);
  }
  if (weights.length === 0) return [];
  if (weights.some((w) => !(w >= 0))) {
    throw new Error('Allocation weights must be non-negative numbers');
  }

  const sum = weights.reduce((a, b) => a + b, 0);
  // Nothing to weigh by (every line free): split evenly rather than dump it all on one.
  const basis = sum > 0 ? weights : weights.map(() => 1);
  const basisSum = sum > 0 ? sum : weights.length;

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const exact = basis.map((w) => (abs * w) / basisSum);
  const parts = exact.map(Math.floor);
  let leftover = abs - parts.reduce((a, b) => a + b, 0);

  // Ties go to the earlier line, so the same cart always allocates the same way.
  const order = exact
    .map((e, i) => ({ i, rem: e - Math.floor(e) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (leftover <= 0) break;
    parts[i] = (parts[i] ?? 0) + 1;
    leftover--;
  }

  return parts.map((p) => sign * p);
}

/** For per-gram costs, where centavo precision is not enough to be meaningful. */
export function formatUnitCost(pesos: Pesos, unit: string): string {
  return `₱${roundUnitCost(pesos).toFixed(4)}/${unit}`;
}
