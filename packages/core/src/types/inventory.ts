import type { BaseUnit, Pesos } from './units.js';

/**
 * raw_material  Ingredient — bought and consumed, never sold alone
 * sub_assembly  Prep item — produced in batches, consumed by other recipes
 * composite     Assembled product — built from a recipe at order time
 * resale        Stock product — bought and sold untouched
 *
 * The first two live in inventory; the last two are sellable (see products.ts).
 */
export type ItemType = 'raw_material' | 'sub_assembly' | 'composite' | 'resale';

export interface InventoryItem {
  id: string;
  companyId: string;
  locationId: string;
  name: string;
  category: string;
  itemType: Extract<ItemType, 'raw_material' | 'sub_assembly' | 'resale'>;

  baseUnit: BaseUnit;
  /** Label on the thing you buy: 'Bottle', 'Pack', 'Case'. */
  purchaseUnit: string;
  /** Base units in one purchase unit. 2.5kg bottle of syrup => 2500. */
  packSize: number;
  /** Needed when the label unit and the base unit disagree (2L of sauce is ~2.6kg). */
  densityGPerMl?: number;

  /**
   * Usable fraction of what you buy, 0 < yieldPct <= 1. Grinder retention,
   * steaming loss, purge. Cost is divided by this, so 0.97 means the usable
   * grams cost ~3% more than the purchase price implies.
   */
  yieldPct: number;

  reorderPoint: number;
  parLevel: number;
  isSeasonal: boolean;
  supplierId?: string;
  shelfLifeDays?: number;
  daysAfterOpening?: number;

  /**
   * sub_assembly only: base units produced by one run of its prep recipe.
   * 18 g of dry dose yielding 36 g of espresso means prepYieldQty = 36.
   */
  prepYieldQty?: number;
}

export interface StockBatch {
  id: string;
  itemId: string;
  receivedAt: string;
  expiryDate?: string;
  /** Base units originally received. */
  qtyReceived: number;
  /** Base units still on hand in this batch. */
  qtyRemaining: number;
  /** Landed cost per base unit, yield-adjusted. */
  unitCost: Pesos;
  /** At most one batch per item is open; recipes draw from it first. */
  isOpen: boolean;
  purchaseOrderId?: string;
}

export type MovementReason =
  | 'receipt'
  | 'sale'
  | 'waste'
  | 'staff'
  | 'count_adjustment'
  | 'transfer'
  | 'prep_consume'
  | 'prep_produce';

/** Append-only. on-hand is derived from this ledger, never typed in. */
export interface StockMovement {
  id: string;
  itemId: string;
  batchId?: string;
  reason: MovementReason;
  /** Signed, in base units. Negative consumes. */
  qty: number;
  costAtTime: Pesos;
  referenceId?: string;
  actorId: string;
  occurredAt: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  contact?: string;
  link?: string;
  leadTimeDays: number;
  defaultDeliveryFee: Pesos;
}
