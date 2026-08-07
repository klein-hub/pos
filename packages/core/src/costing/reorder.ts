import type { InventoryItem } from '../types/inventory.js';
import { CostingError } from './batches.js';

/**
 * Movement speed is measured, not judged. The spreadsheet's FAST/SLOW labels
 * were maintained by hand and drifted; these thresholds are days of stock
 * turnover derived from actual consumption.
 */
export type MovementSpeed = 'fast' | 'moderate' | 'slow' | 'seasonal' | 'dormant';

export interface VelocityInput {
  /** Base units consumed over the sampling window. */
  consumedBaseUnits: number;
  /** Length of the window. Four weeks smooths weekday/weekend swing. */
  windowDays: number;
}

/** Base units consumed per day. */
export function dailyVelocity({ consumedBaseUnits, windowDays }: VelocityInput): number {
  if (!(windowDays > 0)) throw new CostingError(`Window must be positive, got ${windowDays}`);
  return Math.max(0, consumedBaseUnits) / windowDays;
}

export function classifyMovement(
  item: Pick<InventoryItem, 'packSize' | 'isSeasonal'>,
  velocityPerDay: number,
): MovementSpeed {
  if (item.isSeasonal) return 'seasonal';
  if (velocityPerDay <= 0) return 'dormant';

  // Normalise against pack size so a 2.5kg bottle and a 1kg pack are comparable:
  // how many days does one purchase unit last?
  const daysPerPurchaseUnit = item.packSize / velocityPerDay;
  if (daysPerPurchaseUnit <= 10) return 'fast';
  if (daysPerPurchaseUnit <= 30) return 'moderate';
  return 'slow';
}

/** Days until stock runs out at current velocity. Infinity when nothing moves. */
export function daysOfCover(onHandBaseUnits: number, velocityPerDay: number): number {
  if (velocityPerDay <= 0) return Number.POSITIVE_INFINITY;
  return onHandBaseUnits / velocityPerDay;
}

export type StockStatus = 'out' | 'critical' | 'below_par' | 'ok' | 'overstocked';

export interface ReorderSuggestion {
  status: StockStatus;
  /** Base units short of par. */
  deficitBaseUnits: number;
  /** What to actually order — whole purchase units, always rounded up. */
  orderPurchaseUnits: number;
  daysOfCover: number;
  /** True when cover is shorter than the supplier can deliver. */
  urgent: boolean;
  reason: string;
}

export interface ReorderInput {
  item: Pick<
    InventoryItem,
    'name' | 'packSize' | 'reorderPoint' | 'parLevel' | 'isSeasonal' | 'shelfLifeDays'
  >;
  /** Base units on hand across all live batches. */
  onHand: number;
  velocityPerDay: number;
  leadTimeDays: number;
}

/**
 * Replaces the spreadsheet's hand-dragged TO BUY column, which produced a
 * nonsensical -7 for a fast-moving item that was actually short 11 packs.
 *
 * Two things it does that a max-minus-onhand formula cannot: it rounds up to
 * whole purchase units (you cannot buy 0.4 of a bottle), and it flags urgency
 * from lead time rather than from a static threshold.
 */
export function suggestReorder({
  item,
  onHand,
  velocityPerDay,
  leadTimeDays,
}: ReorderInput): ReorderSuggestion {
  if (!(item.packSize > 0)) {
    throw new CostingError(`${item.name}: pack size must be positive`);
  }
  if (item.parLevel < item.reorderPoint) {
    throw new CostingError(
      `${item.name}: par level (${item.parLevel}) is below the reorder point (${item.reorderPoint})`,
    );
  }

  const cover = daysOfCover(onHand, velocityPerDay);
  const deficit = Math.max(0, item.parLevel - onHand);
  const orderPurchaseUnits = Math.ceil(deficit / item.packSize);
  const urgent = cover < leadTimeDays;

  const status: StockStatus =
    onHand <= 0
      ? 'out'
      : urgent
        ? 'critical'
        : onHand < item.reorderPoint
          ? 'below_par'
          : onHand > item.parLevel * 1.25
            ? 'overstocked'
            : 'ok';

  return {
    status,
    deficitBaseUnits: deficit,
    orderPurchaseUnits,
    daysOfCover: cover,
    urgent,
    reason: buildReason(status, cover, leadTimeDays, item),
  };
}

function buildReason(
  status: StockStatus,
  cover: number,
  leadTimeDays: number,
  item: Pick<ReorderInput['item'], 'isSeasonal' | 'shelfLifeDays'>,
): string {
  switch (status) {
    case 'out':
      return 'Out of stock.';
    case 'critical':
      return `About ${Math.floor(cover)} day${Math.floor(cover) === 1 ? '' : 's'} of cover left, ` +
        `but delivery takes ${leadTimeDays}. Order now.`;
    case 'below_par':
      return 'Below reorder point — include in the next order.';
    case 'overstocked':
      return item.shelfLifeDays
        ? `Well above par with a ${item.shelfLifeDays}-day shelf life. Hold off; risk of spoilage.`
        : 'Well above par. Hold off on reordering.';
    default:
      return item.isSeasonal ? 'Seasonal item, stocked to plan.' : 'Stock is healthy.';
  }
}

/**
 * Par level driven by demand instead of a fixed ceiling. The spreadsheet capped
 * beans at MAX 10 with 10 on hand — no headroom on the fastest-moving, most
 * perishable item in the shop.
 */
export function suggestParLevel(
  velocityPerDay: number,
  leadTimeDays: number,
  safetyDays = 3,
  shelfLifeDays?: number,
): number {
  const demandDays = leadTimeDays + safetyDays;
  // Never hold more than a shelf life's worth, whatever the demand maths says.
  const cappedDays = shelfLifeDays ? Math.min(demandDays, shelfLifeDays * 0.75) : demandDays;
  return velocityPerDay * cappedDays;
}
