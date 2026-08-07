import type { Dose, DosingUnit } from '../types/units.js';
import { UnitError } from '../types/units.js';
import type { InventoryItem } from '../types/inventory.js';

/**
 * Convert a recipe dose ("2 pumps") into the item's base units ("18 g").
 * A dose with no dosing unit is already in base units.
 */
export function doseToBaseQty(dose: Dose, dosingUnits: readonly DosingUnit[]): number {
  if (!Number.isFinite(dose.qty)) {
    throw new UnitError(`Dose quantity must be a finite number, got ${dose.qty}`);
  }
  // Negatives are legitimate: a modifier that swaps oat for dairy removes 180ml
  // and adds 180ml, and both halves are recipe lines.
  if (!dose.dosingUnitId) return dose.qty;

  const unit = dosingUnits.find((u) => u.id === dose.dosingUnitId);
  if (!unit) {
    throw new UnitError(`Unknown dosing unit "${dose.dosingUnitId}"`);
  }
  if (!(unit.baseQtyPerUnit > 0)) {
    throw new UnitError(
      `Dosing unit "${unit.name}" has a non-positive calibration (${unit.baseQtyPerUnit}). Re-calibrate it.`,
    );
  }
  return dose.qty * unit.baseQtyPerUnit;
}

/**
 * Base units in one purchase unit, honouring the unit printed on the label.
 * Syrup is sold by mass (2.5kg) and sauce by volume (2L) — when the label unit
 * and the base unit disagree, density bridges them.
 */
export function packSizeInBaseUnits(
  item: Pick<InventoryItem, 'packSize' | 'baseUnit' | 'densityGPerMl'>,
  labelUnit: 'g' | 'ml' | 'each' = item.baseUnit,
): number {
  if (labelUnit === item.baseUnit) return item.packSize;

  if (labelUnit === 'each' || item.baseUnit === 'each') {
    throw new UnitError(`Cannot convert between "each" and "${labelUnit}" — these are not commensurable`);
  }

  const density = item.densityGPerMl;
  if (!density || !(density > 0)) {
    throw new UnitError(
      `Converting ${labelUnit} to ${item.baseUnit} needs densityGPerMl on the item (e.g. chocolate sauce ≈ 1.3)`,
    );
  }
  // g -> ml divides by density; ml -> g multiplies.
  return labelUnit === 'g' ? item.packSize / density : item.packSize * density;
}

/** Human-readable stock, promoting to kg/L past 1000 so counts stay legible. */
export function formatQty(qty: number, unit: 'g' | 'ml' | 'each'): string {
  if (unit === 'each') {
    return `${round(qty, 0)} pc${Math.abs(qty) === 1 ? '' : 's'}`;
  }
  if (Math.abs(qty) >= 1000) {
    return `${round(qty / 1000, 2)} ${unit === 'g' ? 'kg' : 'L'}`;
  }
  return `${round(qty, 1)} ${unit}`;
}

function round(v: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
