import {
  daysOfCover,
  expiryStatus,
  fefoOrder,
  formatQty,
  measuredVelocity,
  recipeCost,
  resolveUnitCost,
  suggestReorder,
  totalOnHand,
  type CostingContext,
  type CostSource,
  type ExpiryStatus,
  type InventoryItem,
  type MeasuredVelocity,
  type MovementReason,
  type Pesos,
  type PurchaseOrderLine,
  type ReorderSuggestion,
  type StockBatch,
  type StockMovement,
  type StockStatus,
  type Supplier,
} from '@digita/core';
import type { WasteEntryKind } from '../store/inventoryStore';

/** `untracked` means no batch has ever existed — not the same thing as out of stock. */
export type StockRowStatus = StockStatus | 'untracked';

export interface StockRow {
  item: InventoryItem;
  supplier?: Supplier;
  /** Every batch the item has ever had, including emptied ones. */
  batches: StockBatch[];
  /** Batches with stock, in the order they will be drawn. */
  live: StockBatch[];
  onHand: number;
  unitCost?: Pesos;
  /** `recipe` is a prep item costed from its ingredients because none has been produced yet. */
  costSource: CostSource | 'recipe';
  value: Pesos;
  nextExpiry?: string;
  expiry?: ExpiryStatus;
  velocity: MeasuredVelocity;
  cover: number;
  leadTimeDays: number;
  status: StockRowStatus;
  /** Present when a par level is set. */
  reorder?: ReorderSuggestion;
}

export function buildStockRows({
  items,
  costing,
  batches,
  movements,
  suppliers,
  now = new Date(),
}: {
  items: readonly InventoryItem[];
  costing: CostingContext;
  batches: readonly StockBatch[];
  movements: readonly StockMovement[];
  suppliers: readonly Supplier[];
  now?: Date;
}): StockRow[] {
  return items.map((item) => {
    const own = batches.filter((b) => b.itemId === item.id);
    const live = fefoOrder(own);
    const onHand = totalOnHand(live);
    const supplier = suppliers.find((s) => s.id === item.supplierId);
    const leadTimeDays = supplier?.leadTimeDays ?? 0;

    let { unitCost, source } = resolveUnitCost(own, costing.getItemUnitCost(item.id));
    let costSource: StockRow['costSource'] = source;
    if (own.length === 0 && item.itemType === 'sub_assembly' && item.prepYieldQty) {
      unitCost = recipeCost(item.id, costing).total / item.prepYieldQty;
      costSource = 'recipe';
    }

    const soonest = live
      .filter((b) => b.expiryDate)
      .sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!))[0];

    const velocity = measuredVelocity(movements, item.id, now);

    // suggestReorder rejects par below the reorder point; the settings form
    // prevents that, so an inconsistent pair simply gets no suggestion.
    const reorder =
      item.parLevel > 0 && item.parLevel >= item.reorderPoint
        ? suggestReorder({ item, onHand, velocityPerDay: velocity.perDay, leadTimeDays })
        : undefined;

    const status: StockRowStatus =
      own.length === 0 ? 'untracked' : reorder ? reorder.status : onHand <= 0 ? 'out' : 'ok';

    return {
      item,
      supplier,
      batches: own,
      live,
      onHand,
      unitCost,
      costSource,
      value: live.reduce((sum, b) => sum + b.qtyRemaining * b.unitCost, 0),
      nextExpiry: soonest?.expiryDate,
      expiry: soonest ? expiryStatus(soonest, now) : undefined,
      velocity,
      cover: daysOfCover(onHand, velocity.perDay),
      leadTimeDays,
      status,
      reorder,
    };
  });
}

export interface OrderLineProgress {
  line: PurchaseOrderLine;
  receivedUnits: number;
  /** Purchase units still to come. Zero or less means the line is complete. */
  outstanding: number;
}

/**
 * How much of each order line has arrived, read from the batches that carry the
 * order's id rather than from a counter — a delivery split over two days is two
 * receipts against one order, and the order completes when the batches say so.
 */
export function purchaseOrderProgress(
  poId: string,
  poLines: readonly PurchaseOrderLine[],
  batches: readonly StockBatch[],
  items: readonly InventoryItem[],
): OrderLineProgress[] {
  return poLines
    .filter((l) => l.purchaseOrderId === poId)
    .map((line) => {
      const packSize = items.find((i) => i.id === line.itemId)?.packSize ?? 1;
      const receivedBase = batches
        .filter((b) => b.purchaseOrderId === poId && b.itemId === line.itemId)
        .reduce((sum, b) => sum + b.qtyReceived, 0);
      const receivedUnits = receivedBase / packSize;
      return { line, receivedUnits, outstanding: line.qtyPurchaseUnits - receivedUnits };
    });
}

export function plural(unit: string, n: number): string {
  if (n === 1 || /s$/i.test(unit)) return unit;
  return /(ch|sh|x)$/i.test(unit) ? `${unit}es` : `${unit}s`;
}

/**
 * Stock as it sits on the shelf: whole purchase units plus what is left in the
 * open one. With at most one container open per item, on-hand splits exactly
 * this way, so "3 Bottles + 1.2 L" is what a counter will actually see.
 */
export function formatStock(
  qty: number,
  item: Pick<InventoryItem, 'packSize' | 'purchaseUnit' | 'baseUnit' | 'itemType'>,
): string {
  if (item.packSize <= 1 || item.itemType === 'sub_assembly') return formatQty(qty, item.baseUnit);
  const packs = Math.floor((qty + 1e-9) / item.packSize);
  const rest = qty - packs * item.packSize;
  if (packs === 0) return formatQty(rest, item.baseUnit);
  const whole = `${packs} ${plural(item.purchaseUnit, packs)}`;
  return rest > 1e-6 ? `${whole} + ${formatQty(rest, item.baseUnit)}` : whole;
}

export function formatPesos(value: Pesos): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string, withYear = false): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Local calendar date as YYYY-MM-DD, for date inputs. */
export function isoDate(daysFromToday = 0): string {
  const d = new Date(Date.now() + daysFromToday * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const STATUS_META: Record<StockRowStatus, { label: string; scheme: string; rank: number }> = {
  out: { label: 'Out', scheme: 'red', rank: 0 },
  critical: { label: 'Order now', scheme: 'red', rank: 1 },
  below_par: { label: 'Reorder', scheme: 'orange', rank: 2 },
  ok: { label: 'OK', scheme: 'green', rank: 4 },
  overstocked: { label: 'Overstocked', scheme: 'blue', rank: 3 },
  untracked: { label: 'Not counted', scheme: 'gray', rank: 5 },
};

export const EXPIRY_META: Record<ExpiryStatus, { label: string; scheme: string }> = {
  expired: { label: 'Expired', scheme: 'red' },
  critical: { label: '≤ 3 days', scheme: 'red' },
  warning: { label: '≤ 14 days', scheme: 'orange' },
  ok: { label: 'OK', scheme: 'green' },
  unknown: { label: 'No date', scheme: 'gray' },
};

export const WASTE_KIND_LABEL: Record<WasteEntryKind, string> = {
  spill: 'Spill',
  spoiled: 'Spoiled',
  expired: 'Expired',
  remake: 'Remake',
  other: 'Other',
  staff: 'Staff use',
};

export const REASON_LABEL: Record<MovementReason, string> = {
  receipt: 'Received',
  sale: 'Sold',
  waste: 'Waste',
  staff: 'Staff use',
  count_adjustment: 'Count',
  transfer: 'Transfer',
  prep_consume: 'Used in prep',
  prep_produce: 'Prepped',
};
