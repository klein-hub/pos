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

/** For per-gram costs, where centavo precision is not enough to be meaningful. */
export function formatUnitCost(pesos: Pesos, unit: string): string {
  return `₱${roundUnitCost(pesos).toFixed(4)}/${unit}`;
}
