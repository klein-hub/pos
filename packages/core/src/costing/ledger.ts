import type {
  InventoryItem,
  MovementReason,
  StockBatch,
  StockMovement,
  WasteKind,
} from '../types/inventory.js';
import type { RecipeLine } from '../types/products.js';
import type { BaseUnit, DosingUnit, Pesos } from '../types/units.js';
import { roundUnitCost } from '../utils/money.js';
import {
  CostingError,
  allocateDeliveryFee,
  compareFefo,
  landedUnitCost,
  planConsumption,
  resolveUnitCost,
  totalOnHand,
} from './batches.js';
import { usableYield } from './recipe.js';
import { doseToBaseQty, packSizeInBaseUnits } from './units.js';

/**
 * Every operation that changes stock. Each one is pure: it takes the batches it
 * needs and returns the batches it changed plus the movements to append, so the
 * POS, the admin app and the tests all apply stock changes identically.
 *
 * Invariant kept by every function here: for each batch, the sum of its
 * movements equals its qtyRemaining. reconcileLedger checks it.
 */

/** Quantities match the schema's numeric(14, 4), so in-memory sums reconcile the way stored ones will. */
export const QTY_PRECISION = 4;

export function roundQty(value: number): number {
  const f = 10 ** QTY_PRECISION;
  return Math.round(value * f) / f;
}

export interface LedgerContext {
  newId: () => string;
  actorId: string;
  /** ISO timestamp stamped on every batch and movement the operation creates. */
  now: string;
}

export interface LedgerChange {
  /** New and updated batches only. Callers upsert by id. */
  batches: StockBatch[];
  /** Movements to append. */
  movements: StockMovement[];
}

function movement(
  ctx: LedgerContext,
  fields: Omit<StockMovement, 'id' | 'actorId' | 'occurredAt'>,
): StockMovement {
  const m: StockMovement = { id: ctx.newId(), actorId: ctx.actorId, occurredAt: ctx.now, ...fields };
  // Keep absent optionals absent rather than present-but-undefined.
  for (const key of ['wasteKind', 'referenceId', 'note', 'batchId'] as const) {
    if (m[key] === undefined) delete m[key];
  }
  return m;
}

// --- Receiving -----------------------------------------------------------------

export interface ReceiptLineInput {
  item: Pick<InventoryItem, 'id' | 'name' | 'baseUnit' | 'packSize' | 'densityGPerMl'>;
  qtyPurchaseUnits: number;
  /** Pesos paid for the whole line, before delivery. */
  linePrice: Pesos;
  /** Pack size printed on this delivery's label, in labelUnit. Defaults to the item's. */
  labelPackSize?: number;
  /** Unit printed on the label. Defaults to the item's base unit. */
  labelUnit?: BaseUnit;
  expiryDate?: string;
}

export interface ReceiptInput {
  lines: readonly ReceiptLineInput[];
  deliveryFee?: Pesos;
  purchaseOrderId?: string;
  /** Groups the receipt's movements as one delivery. Defaults to a fresh id. */
  referenceId?: string;
  note?: string;
}

export interface ReceiptResult extends LedgerChange {
  lines: {
    itemId: string;
    batchId: string;
    baseQty: number;
    allocatedDeliveryFee: Pesos;
    unitCost: Pesos;
  }[];
}

/**
 * Receive Stock — the keystone operation. One batch per line, landed cost with
 * the delivery fee allocated by line value.
 *
 * Batch cost is per *physical* base unit. Yield loss is deliberately not applied
 * here: recipeCost divides by yield when it draws from stock, so a yield-adjusted
 * batch cost would count the same loss twice (3% on beans at 97% yield). Keeping
 * the batch physical also keeps on-hand comparable with what a count finds.
 */
export function receiveStock(input: ReceiptInput, ctx: LedgerContext): ReceiptResult {
  if (input.lines.length === 0) {
    throw new CostingError('A receipt needs at least one line');
  }
  const deliveryFee = input.deliveryFee ?? 0;
  if (deliveryFee < 0) throw new CostingError('Delivery fee must not be negative');

  const referenceId = input.referenceId ?? ctx.newId();
  const fees = allocateDeliveryFee(
    input.lines.map((l) => l.linePrice),
    deliveryFee,
  );

  const result: ReceiptResult = { batches: [], movements: [], lines: [] };

  input.lines.forEach((line, i) => {
    const packSize = packSizeInBaseUnits(
      { ...line.item, packSize: line.labelPackSize ?? line.item.packSize },
      line.labelUnit ?? line.item.baseUnit,
    );
    const unitCost = landedUnitCost({
      qtyPurchaseUnits: line.qtyPurchaseUnits,
      packSizeBaseUnits: packSize,
      linePrice: line.linePrice,
      allocatedDeliveryFee: fees[i] ?? 0,
    });
    const baseQty = roundQty(line.qtyPurchaseUnits * packSize);

    const batch: StockBatch = {
      id: ctx.newId(),
      itemId: line.item.id,
      receivedAt: ctx.now,
      qtyReceived: baseQty,
      qtyRemaining: baseQty,
      unitCost,
      isOpen: false,
      ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
      ...(input.purchaseOrderId ? { purchaseOrderId: input.purchaseOrderId } : {}),
    };

    result.batches.push(batch);
    result.movements.push(
      movement(ctx, {
        itemId: line.item.id,
        batchId: batch.id,
        reason: 'receipt',
        qty: baseQty,
        costAtTime: unitCost,
        referenceId,
        note: input.note,
      }),
    );
    result.lines.push({
      itemId: line.item.id,
      batchId: batch.id,
      baseQty,
      allocatedDeliveryFee: fees[i] ?? 0,
      unitCost,
    });
  });

  return result;
}

// --- Consuming -----------------------------------------------------------------

export type ConsumptionReason = Extract<
  MovementReason,
  'sale' | 'waste' | 'staff' | 'count_adjustment' | 'transfer' | 'prep_consume'
>;

export interface ConsumeInput {
  itemId: string;
  /** The item's batches. Batches of other items are ignored. */
  batches: readonly StockBatch[];
  /** Base units, positive. */
  qty: number;
  reason: ConsumptionReason;
  /**
   * Draw from this batch only. Writing off an expired sealed bottle must take
   * that bottle, not whatever FEFO would serve next.
   */
  batchId?: string;
  wasteKind?: WasteKind;
  referenceId?: string;
  note?: string;
}

export interface ConsumeResult extends LedgerChange {
  /** What the consumed stock cost, batch by batch. */
  cost: Pesos;
  /** Base units the records could not cover. Not posted — it surfaces at the next count. */
  shortfall: number;
}

/**
 * Take stock out, FEFO, costing each part at its own batch's price.
 *
 * Container bookkeeping follows what happens at the bar: drawing into a sealed
 * batch means someone opened it, and an emptied container is no longer open.
 * That keeps "N sealed plus one open" true without anyone tapping a button.
 */
export function consumeStock(input: ConsumeInput, ctx: LedgerContext): ConsumeResult {
  const { itemId, reason } = input;
  const qty = roundQty(input.qty);
  if (!(qty > 0)) {
    throw new CostingError(`Quantity to consume must be positive, got ${input.qty}`);
  }
  if (input.wasteKind && reason !== 'waste') {
    throw new CostingError(`A waste kind only applies to waste, not to "${reason}"`);
  }

  const own = input.batches.filter((b) => b.itemId === itemId);
  const pool = input.batchId ? own.filter((b) => b.id === input.batchId) : own;
  if (input.batchId && pool.length === 0) {
    throw new CostingError(`Batch ${input.batchId} does not belong to ${itemId}`);
  }

  const plan = planConsumption(pool, qty);
  const changed = new Map<string, StockBatch>();
  const movements: StockMovement[] = [];

  for (const a of plan.allocations) {
    const current = changed.get(a.batchId) ?? own.find((b) => b.id === a.batchId)!;
    changed.set(a.batchId, { ...current, qtyRemaining: roundQty(current.qtyRemaining - a.qty) });
    movements.push(
      movement(ctx, {
        itemId,
        batchId: a.batchId,
        reason,
        qty: -roundQty(a.qty),
        costAtTime: a.unitCost,
        wasteKind: input.wasteKind,
        referenceId: input.referenceId,
        note: input.note,
      }),
    );
  }

  const after = own.map((b) => changed.get(b.id) ?? b);
  for (const b of after) {
    if (b.isOpen && b.qtyRemaining <= 0) changed.set(b.id, { ...b, isOpen: false });
  }

  // A targeted write-off is a record correction, not someone breaking a seal.
  const last = plan.allocations[plan.allocations.length - 1];
  if (!input.batchId && last) {
    const broken = changed.get(last.batchId)!;
    const otherOpen = after.some((b) => b.id !== broken.id && b.isOpen && b.qtyRemaining > 0);
    if (broken.qtyRemaining > 0 && !broken.isOpen && !otherOpen) {
      changed.set(broken.id, { ...broken, isOpen: true });
    }
  }

  return {
    batches: [...changed.values()],
    movements,
    cost: plan.totalCost,
    shortfall: plan.shortfall,
  };
}

// --- Counting ------------------------------------------------------------------

export interface CountInput {
  itemId: string;
  batches: readonly StockBatch[];
  /** Base units physically found. */
  countedQty: number;
  /** Cost for found stock when no batch has ever priced this item — the price list. */
  fallbackUnitCost?: Pesos;
  /** The count session. */
  referenceId?: string;
}

export interface CountResult extends LedgerChange {
  expectedQty: number;
  countedQty: number;
  /** counted − expected. Negative is shrinkage. */
  varianceQty: number;
  varianceValue: Pesos;
  /** No batch existed: this count set the opening balance rather than finding a variance. */
  isOpening: boolean;
}

/**
 * Post a physical count, making the ledger agree with the shelf.
 *
 * Shrinkage comes out FEFO, valued at the batches it came out of. Found stock
 * goes back into batches that have room first — the open carton held more than
 * the recipes said — and only the excess becomes a new batch, at the item's
 * current cost. The first count of a never-stocked item is how opening balances
 * get into the system without anyone inventing them.
 */
export function countStock(input: CountInput, ctx: LedgerContext): CountResult {
  const counted = roundQty(input.countedQty);
  if (!Number.isFinite(counted) || counted < 0) {
    throw new CostingError(`A count must be zero or more, got ${input.countedQty}`);
  }

  const own = input.batches.filter((b) => b.itemId === input.itemId);
  const expected = roundQty(totalOnHand(own));
  const variance = roundQty(counted - expected);
  const base = { expectedQty: expected, countedQty: counted, varianceQty: variance, isOpening: own.length === 0 };

  if (variance === 0) {
    return { ...base, batches: [], movements: [], varianceValue: 0 };
  }

  if (variance < 0) {
    const taken = consumeStock(
      {
        itemId: input.itemId,
        batches: own,
        qty: -variance,
        reason: 'count_adjustment',
        referenceId: input.referenceId,
      },
      ctx,
    );
    return { ...base, batches: taken.batches, movements: taken.movements, varianceValue: -taken.cost };
  }

  const batches: StockBatch[] = [];
  const movements: StockMovement[] = [];
  let remaining = variance;
  let value = 0;

  // Not fefoOrder: that skips empty batches, and an emptied carton is exactly
  // where found stock most often belongs.
  const withRoom = own.filter((b) => b.qtyReceived - b.qtyRemaining > 0).sort(compareFefo);

  for (const b of withRoom) {
    if (remaining <= 0) break;
    const put = roundQty(Math.min(b.qtyReceived - b.qtyRemaining, remaining));
    batches.push({ ...b, qtyRemaining: roundQty(b.qtyRemaining + put) });
    movements.push(
      movement(ctx, {
        itemId: input.itemId,
        batchId: b.id,
        reason: 'count_adjustment',
        qty: put,
        costAtTime: b.unitCost,
        referenceId: input.referenceId,
      }),
    );
    value += put * b.unitCost;
    remaining = roundQty(remaining - put);
  }

  if (remaining > 0) {
    const unitCost = resolveUnitCost(own, input.fallbackUnitCost).unitCost ?? 0;
    const created: StockBatch = {
      id: ctx.newId(),
      itemId: input.itemId,
      receivedAt: ctx.now,
      qtyReceived: remaining,
      qtyRemaining: remaining,
      unitCost,
      isOpen: false,
    };
    batches.push(created);
    movements.push(
      movement(ctx, {
        itemId: input.itemId,
        batchId: created.id,
        reason: 'count_adjustment',
        qty: remaining,
        costAtTime: unitCost,
        referenceId: input.referenceId,
      }),
    );
    value += remaining * unitCost;
  }

  return { ...base, batches, movements, varianceValue: roundUnitCost(value) };
}

// --- Containers ----------------------------------------------------------------

/**
 * Mark a sealed batch as the open container. Refuses while another container
 * still has stock: two open bottles of the same syrup is exactly the state FEFO
 * and the "N sealed + one open" count both depend on never happening.
 */
export function openContainer(batches: readonly StockBatch[], batchId: string): StockBatch[] {
  const target = batches.find((b) => b.id === batchId);
  if (!target) throw new CostingError(`Unknown batch ${batchId}`);
  if (!(target.qtyRemaining > 0)) throw new CostingError('That batch is empty — there is nothing to open');
  if (target.isOpen) return [];

  const siblings = batches.filter((b) => b.itemId === target.itemId && b.id !== batchId && b.isOpen);
  const stillOpen = siblings.find((b) => b.qtyRemaining > 0);
  if (stillOpen) {
    throw new CostingError(
      `Another container is still open with ${stillOpen.qtyRemaining} left. Finish it, or count it, first.`,
    );
  }

  return [...siblings.map((b) => ({ ...b, isOpen: false })), { ...target, isOpen: true }];
}

// --- Prep production -----------------------------------------------------------

export interface PrepRunInput {
  item: InventoryItem;
  /** Times the prep recipe was made. 0.5 is a half batch. */
  runs: number;
  /** The prep item's own recipe lines. */
  lines: readonly RecipeLine[];
  getItem: (itemId: string) => InventoryItem | undefined;
  getBatches: (itemId: string) => readonly StockBatch[];
  getDosingUnits?: (itemId: string) => readonly DosingUnit[];
  /** Cost for any ingredient the records are short of — price list or theoretical. */
  fallbackUnitCost: (itemId: string) => Pesos | undefined;
  expiryDate?: string;
  referenceId?: string;
}

export interface PrepRunResult extends LedgerChange {
  producedQty: number;
  totalCost: Pesos;
  unitCost: Pesos;
  /** Ingredients used that the records did not show on hand. Each becomes a count variance. */
  shortfalls: { itemId: string; qty: number; costedAt: Pesos | undefined }[];
}

/**
 * Make a batch of a prep item: consume its ingredients and produce a batch that
 * carries what they actually cost. From then on a cheesecake slice costs against
 * the cake it was cut from, exactly like milk costs against its carton.
 *
 * One level only — a nested prep ingredient is drawn from its own stock, because
 * that is what physically happens in the kitchen.
 */
export function producePrep(input: PrepRunInput, ctx: LedgerContext): PrepRunResult {
  const { item, runs } = input;
  if (item.itemType !== 'sub_assembly' || !item.prepYieldQty || !(item.prepYieldQty > 0)) {
    throw new CostingError(`"${item.name}" is not a prep item with a yield, so it cannot be produced`);
  }
  if (!(runs > 0)) throw new CostingError(`Runs must be positive, got ${runs}`);

  const referenceId = input.referenceId ?? ctx.newId();
  const result: PrepRunResult = {
    batches: [],
    movements: [],
    producedQty: 0,
    totalCost: 0,
    unitCost: 0,
    shortfalls: [],
  };
  let total = 0;

  for (const line of input.lines) {
    const ingredient = input.getItem(line.itemId);
    if (!ingredient) throw new CostingError(`Prep recipe references a missing item (${line.itemId})`);

    const perRun = doseToBaseQty(line.dose, input.getDosingUnits?.(ingredient.id) ?? []);
    const need = roundQty((perRun * runs) / usableYield(ingredient.yieldPct));
    if (!(need > 0)) continue;

    const taken = consumeStock(
      { itemId: ingredient.id, batches: input.getBatches(ingredient.id), qty: need, reason: 'prep_consume', referenceId },
      ctx,
    );
    result.batches.push(...taken.batches);
    result.movements.push(...taken.movements);
    total += taken.cost;

    if (taken.shortfall > 0) {
      const costedAt = input.fallbackUnitCost(ingredient.id);
      if (costedAt !== undefined) total += taken.shortfall * costedAt;
      result.shortfalls.push({ itemId: ingredient.id, qty: taken.shortfall, costedAt });
    }
  }

  const producedQty = roundQty(item.prepYieldQty * runs);
  const unitCost = roundUnitCost(total / producedQty);
  const produced: StockBatch = {
    id: ctx.newId(),
    itemId: item.id,
    receivedAt: ctx.now,
    qtyReceived: producedQty,
    qtyRemaining: producedQty,
    unitCost,
    isOpen: false,
    ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
  };
  result.batches.push(produced);
  result.movements.push(
    movement(ctx, {
      itemId: item.id,
      batchId: produced.id,
      reason: 'prep_produce',
      qty: producedQty,
      costAtTime: unitCost,
      referenceId,
    }),
  );

  return { ...result, producedQty, totalCost: roundUnitCost(total), unitCost };
}

// --- Reconciliation ------------------------------------------------------------

export interface LedgerMismatch {
  batchId: string;
  itemId: string;
  qtyRemaining: number;
  /** What the batch's movements add up to. */
  ledgerQty: number;
}

/**
 * Proof that on-hand is derived rather than typed: every batch's quantity must
 * equal the sum of its movements. An empty result means the books balance.
 */
export function reconcileLedger(
  batches: readonly StockBatch[],
  movements: readonly StockMovement[],
): LedgerMismatch[] {
  const ledger = new Map<string, number>();
  for (const m of movements) {
    if (m.batchId) ledger.set(m.batchId, (ledger.get(m.batchId) ?? 0) + m.qty);
  }
  return batches
    .map((b) => ({
      batchId: b.id,
      itemId: b.itemId,
      qtyRemaining: b.qtyRemaining,
      ledgerQty: roundQty(ledger.get(b.id) ?? 0),
    }))
    .filter((r) => Math.abs(r.ledgerQty - r.qtyRemaining) > 10 ** -QTY_PRECISION);
}
