import type { StockBatch } from '../types/inventory.js';
import type { Pesos } from '../types/units.js';
import { roundUnitCost } from '../utils/money.js';

export class CostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CostingError';
  }
}

export interface LandedCostInput {
  /** Purchase units received (4 bottles). */
  qtyPurchaseUnits: number;
  /** Base units per purchase unit (2500 g). */
  packSizeBaseUnits: number;
  /** What the line cost, in pesos, before delivery. */
  linePrice: Pesos;
  /** This line's share of the order's delivery fee, in pesos. */
  allocatedDeliveryFee?: Pesos;
  /** Usable fraction, 0 < yieldPct <= 1. */
  yieldPct?: number;
}

/**
 * Landed, yield-adjusted cost of one base unit.
 *
 * Delivery is part of what the stock cost you — ₱188 over a small order moves
 * per-gram cost by a few percent, which is the difference between a real margin
 * and a flattering one.
 */
export function landedUnitCost(input: LandedCostInput): Pesos {
  const { qtyPurchaseUnits, packSizeBaseUnits, linePrice } = input;
  const deliveryFee = input.allocatedDeliveryFee ?? 0;
  const yieldPct = input.yieldPct ?? 1;

  if (!(qtyPurchaseUnits > 0)) {
    throw new CostingError(`Received quantity must be positive, got ${qtyPurchaseUnits}`);
  }
  if (!(packSizeBaseUnits > 0)) {
    throw new CostingError(`Pack size must be positive, got ${packSizeBaseUnits}`);
  }
  if (linePrice < 0 || deliveryFee < 0) {
    throw new CostingError('Prices and delivery fees must not be negative');
  }
  if (!(yieldPct > 0) || yieldPct > 1) {
    throw new CostingError(`yieldPct must be within (0, 1], got ${yieldPct}`);
  }

  const usableBaseUnits = qtyPurchaseUnits * packSizeBaseUnits * yieldPct;
  return roundUnitCost((linePrice + deliveryFee) / usableBaseUnits);
}

/** Split an order-level delivery fee across lines in proportion to line value. */
export function allocateDeliveryFee(linePrices: readonly Pesos[], deliveryFee: Pesos): Pesos[] {
  const total = linePrices.reduce((a, b) => a + b, 0);
  if (linePrices.length === 0) return [];
  if (total <= 0) {
    // Free goods still consumed delivery capacity — split it evenly.
    const even = deliveryFee / linePrices.length;
    return linePrices.map(() => even);
  }
  return linePrices.map((p) => (p / total) * deliveryFee);
}

export function totalOnHand(batches: readonly StockBatch[]): number {
  return batches.reduce((sum, b) => sum + Math.max(0, b.qtyRemaining), 0);
}

/**
 * The single cost figure shown in the UI: weighted average across remaining
 * stock. Individual sales still cost against their own batch — this exists so
 * menu pricing has one stable number instead of flickering as bags change over.
 */
export function weightedAverageUnitCost(batches: readonly StockBatch[]): Pesos {
  const live = batches.filter((b) => b.qtyRemaining > 0);
  const qty = totalOnHand(live);
  if (qty <= 0) {
    // No stock: fall back to the most recent known price so costing never
    // silently reports zero, which would show an impossible 100% margin.
    const latest = [...batches].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
    return latest ? roundUnitCost(latest.unitCost) : 0;
  }
  const value = live.reduce((sum, b) => sum + b.qtyRemaining * b.unitCost, 0);
  return roundUnitCost(value / qty);
}

export interface BatchAllocation {
  batchId: string;
  qty: number;
  unitCost: Pesos;
  cost: Pesos;
}

export interface ConsumptionPlan {
  allocations: BatchAllocation[];
  totalCost: Pesos;
  /** Base units that could not be covered by stock on hand. */
  shortfall: number;
}

/**
 * FEFO ordering: the open batch first (finish what's already been broken into),
 * then soonest expiry, then oldest received. Batches with no expiry sort last,
 * since a dated batch always has more urgency than an undated one.
 */
export function fefoOrder(batches: readonly StockBatch[]): StockBatch[] {
  return [...batches]
    .filter((b) => b.qtyRemaining > 0)
    .sort((a, b) => {
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
      if (a.expiryDate && b.expiryDate && a.expiryDate !== b.expiryDate) {
        return a.expiryDate.localeCompare(b.expiryDate);
      }
      if (a.expiryDate && !b.expiryDate) return -1;
      if (!a.expiryDate && b.expiryDate) return 1;
      return a.receivedAt.localeCompare(b.receivedAt);
    });
}

/**
 * Plan a consumption without mutating anything. Returns a shortfall rather than
 * throwing: a sale should still complete when stock records lag reality, and the
 * shortfall becomes a variance to reconcile at the next count.
 */
export function planConsumption(batches: readonly StockBatch[], qtyNeeded: number): ConsumptionPlan {
  if (qtyNeeded < 0) {
    throw new CostingError(`Cannot consume a negative quantity (${qtyNeeded})`);
  }

  const allocations: BatchAllocation[] = [];
  let remaining = qtyNeeded;

  for (const batch of fefoOrder(batches)) {
    if (remaining <= 0) break;
    const take = Math.min(batch.qtyRemaining, remaining);
    allocations.push({
      batchId: batch.id,
      qty: take,
      unitCost: batch.unitCost,
      cost: roundUnitCost(take * batch.unitCost),
    });
    remaining -= take;
  }

  return {
    allocations,
    totalCost: roundUnitCost(allocations.reduce((sum, a) => sum + a.cost, 0)),
    shortfall: roundUnitCost(Math.max(0, remaining)),
  };
}

export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok' | 'unknown';

/** Expiry buckets used for the item badges and the expiry-watch report. */
export function expiryStatus(batch: StockBatch, today: Date = new Date()): ExpiryStatus {
  if (!batch.expiryDate) return 'unknown';
  const days = daysUntil(batch.expiryDate, today);
  if (days < 0) return 'expired';
  if (days <= 3) return 'critical';
  if (days <= 14) return 'warning';
  return 'ok';
}

export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const target = Date.parse(isoDate);
  if (Number.isNaN(target)) throw new CostingError(`Invalid date "${isoDate}"`);
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((target - startOfToday) / 86_400_000);
}
