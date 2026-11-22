import type { InventoryItem } from '../types/inventory.js';
import type { RecipeLine } from '../types/products.js';
import type { DosingUnit, Pesos } from '../types/units.js';
import { roundUnitCost } from '../utils/money.js';
import { CostingError } from './batches.js';
import { doseToBaseQty } from './units.js';

/** Guards against a prep recipe chain that is pathological rather than merely deep. */
export const MAX_RECIPE_DEPTH = 8;

/**
 * The yield actually applied to an item: out-of-range values are treated as 1
 * rather than allowed to inflate (or zero-divide) a draw. Costing and stock
 * deduction must apply the same rule or COGS and the ledger disagree.
 */
export function usableYield(yieldPct: number): number {
  return yieldPct > 0 && yieldPct <= 1 ? yieldPct : 1;
}

/**
 * Everything the roll-up needs, supplied by the caller. Keeping this an
 * interface is what lets the identical engine run against live Supabase data
 * on the POS, against a what-if scenario in the admin price simulator, and
 * against fixtures in tests.
 */
export interface CostingContext {
  getItem(itemId: string): InventoryItem | undefined;
  /** Weighted-average cost per base unit for a purchased item. */
  getItemUnitCost(itemId: string): Pesos | undefined;
  getDosingUnits(itemId: string): readonly DosingUnit[];
  /** Recipe lines owned by a variant, modifier, or sub-assembly item. */
  getRecipeLines(ownerId: string): readonly RecipeLine[];
}

export interface CostBreakdownLine {
  itemId: string;
  itemName: string;
  /** Quantity before yield loss, as the recipe author wrote it. */
  qty: number;
  unit: string;
  /** Quantity actually drawn from stock once yield loss is applied. */
  effectiveQty: number;
  unitCost: Pesos;
  cost: Pesos;
  /** Populated when this line is a sub-assembly, so the UI can drill in. */
  children?: CostBreakdownLine[];
}

export interface CostBreakdown {
  total: Pesos;
  lines: CostBreakdownLine[];
  /** Non-fatal problems: missing costs, uncalibrated pumps, orphaned items. */
  warnings: string[];
}

/**
 * Cost of one unit of a sub-assembly item, derived from its prep recipe.
 *
 * This is the *theoretical* cost, used for menu design and what-if pricing. At
 * runtime a produced prep batch carries its own actual cost, exactly like a
 * purchased batch — see planConsumption.
 */
function subAssemblyUnitCost(
  item: InventoryItem,
  ctx: CostingContext,
  seen: Set<string>,
  depth: number,
  warnings: string[],
): { unitCost: Pesos; children: CostBreakdownLine[] } {
  if (!item.prepYieldQty || !(item.prepYieldQty > 0)) {
    warnings.push(`"${item.name}" is a prep item but has no yield quantity — its cost cannot be derived.`);
    return { unitCost: 0, children: [] };
  }

  const inner = rollUp(item.id, ctx, seen, depth + 1, warnings);
  return {
    unitCost: roundUnitCost(inner.total / item.prepYieldQty),
    children: inner.lines,
  };
}

function rollUp(
  ownerId: string,
  ctx: CostingContext,
  seen: Set<string>,
  depth: number,
  warnings: string[],
): CostBreakdown {
  if (depth > MAX_RECIPE_DEPTH) {
    throw new CostingError(`Recipe nesting exceeded ${MAX_RECIPE_DEPTH} levels at "${ownerId}"`);
  }
  if (seen.has(ownerId)) {
    throw new CostingError(
      `Circular recipe detected: "${ownerId}" is an ingredient of itself. Break the loop before costing.`,
    );
  }
  seen.add(ownerId);

  const lines: CostBreakdownLine[] = [];
  let total = 0;

  for (const line of ctx.getRecipeLines(ownerId)) {
    const item = ctx.getItem(line.itemId);
    if (!item) {
      warnings.push(`Recipe references a missing item (${line.itemId}) — that cost is not counted.`);
      continue;
    }

    let baseQty: number;
    try {
      baseQty = doseToBaseQty(line.dose, ctx.getDosingUnits(item.id));
    } catch (err) {
      warnings.push(`${item.name}: ${(err as Error).message}`);
      continue;
    }

    // Yield loss means you must draw more from stock than the recipe calls for.
    const yieldPct = usableYield(item.yieldPct);
    if (yieldPct !== item.yieldPct) {
      warnings.push(`${item.name}: yield ${item.yieldPct} is out of range, treated as 1.`);
    }
    const effectiveQty = baseQty / yieldPct;

    let unitCost: Pesos;
    let children: CostBreakdownLine[] | undefined;

    if (item.itemType === 'sub_assembly') {
      const nested = subAssemblyUnitCost(item, ctx, new Set(seen), depth, warnings);
      unitCost = nested.unitCost;
      children = nested.children;
    } else {
      const known = ctx.getItemUnitCost(item.id);
      if (known === undefined) {
        warnings.push(`${item.name} has no cost on record — receive stock for it to make margins accurate.`);
        unitCost = 0;
      } else {
        unitCost = known;
      }
    }

    const cost = roundUnitCost(effectiveQty * unitCost);
    total += cost;

    lines.push({
      itemId: item.id,
      itemName: item.name,
      qty: baseQty,
      unit: item.baseUnit,
      effectiveQty: roundUnitCost(effectiveQty),
      unitCost,
      cost,
      ...(children && children.length > 0 ? { children } : {}),
    });
  }

  return { total: roundUnitCost(total), lines, warnings };
}

/** Cost of a variant, a modifier, or a prep item's recipe, with a full breakdown. */
export function recipeCost(ownerId: string, ctx: CostingContext): CostBreakdown {
  const warnings: string[] = [];
  return rollUp(ownerId, ctx, new Set(), 0, warnings);
}

/**
 * What a drink actually costs as ordered: its recipe plus every selected
 * modifier's own recipe. An extra shot adds 18 g of beans, not a flat guess.
 */
export function variantCost(
  variantId: string,
  modifierIds: readonly string[],
  ctx: CostingContext,
): CostBreakdown {
  const base = recipeCost(variantId, ctx);
  const lines = [...base.lines];
  const warnings = [...base.warnings];
  let total = base.total;

  for (const modifierId of modifierIds) {
    const mod = recipeCost(modifierId, ctx);
    lines.push(...mod.lines);
    warnings.push(...mod.warnings);
    total += mod.total;
  }

  return { total: roundUnitCost(total), lines, warnings };
}
