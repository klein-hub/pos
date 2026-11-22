import { create } from 'zustand';
import {
  consumeStock,
  countStock,
  openContainer,
  producePrep,
  receiveStock,
  recipeCost,
  type ConsumeResult,
  type LedgerContext,
  type Pesos,
  type PrepRunResult,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type ReceiptResult,
  type StockBatch,
  type StockCount,
  type StockCountLine,
  type StockMovement,
  type Supplier,
  type WasteKind,
} from '@digita/core';
import { useAuthStore } from './authStore';
import { buildCostingContext, useCatalogStore } from './catalogStore';
import { purchaseOrderProgress } from '../lib/inventory';

/**
 * Stock, suppliers, purchase orders and counts.
 *
 * Starts empty on purpose. The shop's real on-hand quantities are unknown, and
 * inventing them would make every number downstream — cover, reorder, variance
 * — look measured when it is not. Stock enters the way it will in production:
 * an opening count, a delivery, or a prep run.
 *
 * Every change goes through the ledger functions in @digita/core, so the
 * batches and movements here are the rows the pos_ tables will hold once the
 * app is wired to Supabase. Until then they live in memory.
 */

export interface SupplierInput {
  id?: string;
  name: string;
  contact?: string;
  link?: string;
  leadTimeDays: number;
  defaultDeliveryFee: Pesos;
}

export interface ReceiveLine {
  itemId: string;
  qtyPurchaseUnits: number;
  /** Pesos paid for the whole line, before delivery. */
  linePrice: Pesos;
  /** Base units per purchase unit on this delivery's label, when it differs from the item's. */
  packSize?: number;
  expiryDate?: string;
}

export interface ReceiveInput {
  supplierId?: string;
  deliveryFee: Pesos;
  lines: ReceiveLine[];
  /** Receiving against an order. Without one the delivery is recorded as an order born received. */
  purchaseOrderId?: string;
  note?: string;
}

/** Staff use is its own ledger reason, but it is logged from the same form as waste. */
export type WasteEntryKind = WasteKind | 'staff';

export interface WasteInput {
  itemId: string;
  /** Base units. */
  qty: number;
  kind: WasteEntryKind;
  note?: string;
  /** Write off one specific batch — an expired bottle — instead of drawing FEFO. */
  batchId?: string;
}

export interface PurchaseOrderInput {
  id?: string;
  supplierId?: string;
  deliveryFee: Pesos;
  expectedAt?: string;
  notes?: string;
  lines: Pick<PurchaseOrderLine, 'itemId' | 'qtyPurchaseUnits' | 'linePrice'>[];
}

interface InventoryState {
  suppliers: Supplier[];
  batches: StockBatch[];
  movements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  poLines: PurchaseOrderLine[];
  counts: StockCount[];
  countLines: StockCountLine[];
  /** Items in scope for each count session. */
  countScopes: Record<string, string[]>;
  /** Entries for open counts, in base units. Absent means not counted — never zero. */
  countDrafts: Record<string, Record<string, number>>;

  saveSupplier: (input: SupplierInput) => string;
  receive: (input: ReceiveInput) => ReceiptResult;
  logWaste: (input: WasteInput) => ConsumeResult;
  openBatch: (batchId: string) => void;
  runPrep: (itemId: string, runs: number, expiryDate?: string) => PrepRunResult;
  savePurchaseOrder: (input: PurchaseOrderInput) => string;
  markOrdered: (poId: string) => void;
  cancelPurchaseOrder: (poId: string) => void;
  deletePurchaseOrder: (poId: string) => void;
  startCount: (itemIds: string[], note?: string) => string;
  setCounted: (countId: string, itemId: string, qty: number | null) => void;
  postCount: (countId: string) => StockCountLine[];
  cancelCount: (countId: string) => void;
}

function ledgerContext(): LedgerContext {
  return {
    newId: () => crypto.randomUUID(),
    actorId: useAuthStore.getState().user?.id ?? 'local',
    now: new Date().toISOString(),
  };
}

/** Apply a ledger change set: changed batches replace their old selves, new ones are appended. */
function upsert(batches: readonly StockBatch[], changed: readonly StockBatch[]): StockBatch[] {
  const byId = new Map(changed.map((b) => [b.id, b]));
  const known = new Set(batches.map((b) => b.id));
  return [...batches.map((b) => byId.get(b.id) ?? b), ...changed.filter((b) => !known.has(b.id))];
}

/**
 * Cost for stock the records do not yet price: the price list for a purchased
 * item, the theoretical recipe cost for a prep item. Used for opening counts
 * and for prep ingredients nobody has received yet.
 */
function fallbackUnitCost(itemId: string, batches: readonly StockBatch[]): Pesos | undefined {
  const costing = buildCostingContext(useCatalogStore.getState(), batches);
  const item = costing.getItem(itemId);
  if (item?.itemType === 'sub_assembly' && item.prepYieldQty) {
    return recipeCost(itemId, costing).total / item.prepYieldQty;
  }
  return costing.getItemUnitCost(itemId);
}

function addDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  suppliers: [],
  batches: [],
  movements: [],
  purchaseOrders: [],
  poLines: [],
  counts: [],
  countLines: [],
  countScopes: {},
  countDrafts: {},

  saveSupplier: (input) => {
    const id = input.id ?? crypto.randomUUID();
    const supplier: Supplier = { companyId: 'seed', ...input, id };
    set((s) => ({
      suppliers: s.suppliers.some((x) => x.id === id)
        ? s.suppliers.map((x) => (x.id === id ? supplier : x))
        : [...s.suppliers, supplier],
    }));
    return id;
  },

  receive: (input) => {
    const { items } = useCatalogStore.getState();
    const state = get();
    const po = input.purchaseOrderId
      ? state.purchaseOrders.find((p) => p.id === input.purchaseOrderId)
      : undefined;
    if (input.purchaseOrderId && !po) throw new Error('That purchase order no longer exists');
    if (po && po.status !== 'ordered' && po.status !== 'partial') {
      throw new Error(`A ${po.status} order cannot be received`);
    }

    const ctx = ledgerContext();
    const poId = po?.id ?? ctx.newId();
    const result = receiveStock(
      {
        purchaseOrderId: poId,
        deliveryFee: input.deliveryFee,
        note: input.note,
        lines: input.lines.map((l) => {
          const item = items.find((i) => i.id === l.itemId);
          if (!item) throw new Error(`Unknown item ${l.itemId}`);
          return {
            item,
            qtyPurchaseUnits: l.qtyPurchaseUnits,
            linePrice: l.linePrice,
            labelPackSize: l.packSize,
            expiryDate: l.expiryDate,
          };
        }),
      },
      ctx,
    );

    set((s) => {
      const batches = upsert(s.batches, result.batches);
      if (po) {
        const done = purchaseOrderProgress(po.id, s.poLines, batches, items).every((p) => p.outstanding <= 0);
        return {
          batches,
          movements: [...s.movements, ...result.movements],
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === po.id ? { ...p, status: done ? 'received' : 'partial', receivedAt: ctx.now } : p,
          ),
        };
      }
      // A delivery with no order still gets one, so every delivery — its supplier,
      // its fee, what was paid — shows up in Purchasing's history.
      return {
        batches,
        movements: [...s.movements, ...result.movements],
        purchaseOrders: [
          ...s.purchaseOrders,
          {
            id: poId,
            supplierId: input.supplierId,
            status: 'received',
            deliveryFee: input.deliveryFee,
            receivedAt: ctx.now,
            createdAt: ctx.now,
            notes: input.note,
          },
        ],
        poLines: [
          ...s.poLines,
          ...input.lines.map((l) => ({
            id: ctx.newId(),
            purchaseOrderId: poId,
            itemId: l.itemId,
            qtyPurchaseUnits: l.qtyPurchaseUnits,
            linePrice: l.linePrice,
          })),
        ],
      };
    });
    return result;
  },

  logWaste: (input) => {
    const staff = input.kind === 'staff';
    const result = consumeStock(
      {
        itemId: input.itemId,
        batches: get().batches,
        qty: input.qty,
        reason: staff ? 'staff' : 'waste',
        wasteKind: staff ? undefined : (input.kind as WasteKind),
        batchId: input.batchId,
        note: input.note,
        // One entry can span two batches; the reference keeps it one line in the log.
        referenceId: crypto.randomUUID(),
      },
      ledgerContext(),
    );
    // Unlike a sale, a write-off can wait: logging more than the records hold
    // would post a loss against stock that was never recorded.
    if (result.shortfall > 0) {
      throw new Error('That is more than the records show on hand. Count the item first, then log it.');
    }
    set((s) => ({ batches: upsert(s.batches, result.batches), movements: [...s.movements, ...result.movements] }));
    return result;
  },

  openBatch: (batchId) => {
    const changed = openContainer(get().batches, batchId);
    set((s) => ({ batches: upsert(s.batches, changed) }));
  },

  runPrep: (itemId, runs, expiryDate) => {
    const catalog = useCatalogStore.getState();
    const item = catalog.items.find((i) => i.id === itemId);
    if (!item) throw new Error(`Unknown item ${itemId}`);
    const { batches } = get();
    const costing = buildCostingContext(catalog, batches);

    const result = producePrep(
      {
        item,
        runs,
        expiryDate: expiryDate ?? (item.shelfLifeDays ? addDays(item.shelfLifeDays) : undefined),
        lines: costing.getRecipeLines(itemId),
        getItem: costing.getItem,
        getBatches: (id) => batches.filter((b) => b.itemId === id),
        fallbackUnitCost: (id) => fallbackUnitCost(id, batches),
      },
      ledgerContext(),
    );
    set((s) => ({ batches: upsert(s.batches, result.batches), movements: [...s.movements, ...result.movements] }));
    return result;
  },

  savePurchaseOrder: (input) => {
    const existing = input.id ? get().purchaseOrders.find((p) => p.id === input.id) : undefined;
    if (existing && existing.status !== 'draft') {
      throw new Error('Only a draft order can be edited — it has already gone to the supplier');
    }
    const id = existing?.id ?? crypto.randomUUID();
    const po: PurchaseOrder = {
      ...(existing ?? { id, status: 'draft', createdAt: new Date().toISOString() }),
      supplierId: input.supplierId,
      deliveryFee: input.deliveryFee,
      expectedAt: input.expectedAt,
      notes: input.notes,
    };
    set((s) => ({
      purchaseOrders: existing
        ? s.purchaseOrders.map((p) => (p.id === id ? po : p))
        : [...s.purchaseOrders, po],
      poLines: [
        ...s.poLines.filter((l) => l.purchaseOrderId !== id),
        ...input.lines.map((l) => ({ ...l, id: crypto.randomUUID(), purchaseOrderId: id })),
      ],
    }));
    return id;
  },

  markOrdered: (poId) =>
    set((s) => ({
      purchaseOrders: s.purchaseOrders.map((p) => {
        if (p.id !== poId || p.status !== 'draft') return p;
        const lead = s.suppliers.find((x) => x.id === p.supplierId)?.leadTimeDays;
        return {
          ...p,
          status: 'ordered',
          orderedAt: new Date().toISOString(),
          expectedAt: p.expectedAt ?? (lead !== undefined ? addDays(lead) : undefined),
        };
      }),
    })),

  cancelPurchaseOrder: (poId) =>
    set((s) => ({
      purchaseOrders: s.purchaseOrders.map((p) =>
        p.id === poId && (p.status === 'ordered' || p.status === 'partial') ? { ...p, status: 'cancelled' } : p,
      ),
    })),

  deletePurchaseOrder: (poId) =>
    set((s) => {
      if (s.purchaseOrders.find((p) => p.id === poId)?.status !== 'draft') return s;
      return {
        purchaseOrders: s.purchaseOrders.filter((p) => p.id !== poId),
        poLines: s.poLines.filter((l) => l.purchaseOrderId !== poId),
      };
    }),

  startCount: (itemIds, note) => {
    if (get().counts.some((c) => c.status === 'open')) {
      throw new Error('A count is already open. Post or cancel it first.');
    }
    if (itemIds.length === 0) throw new Error('Nothing to count in that selection');
    const id = crypto.randomUUID();
    set((s) => ({
      counts: [...s.counts, { id, status: 'open', startedAt: new Date().toISOString(), note }],
      countScopes: { ...s.countScopes, [id]: itemIds },
      countDrafts: { ...s.countDrafts, [id]: {} },
    }));
    return id;
  },

  setCounted: (countId, itemId, qty) =>
    set((s) => {
      const draft = { ...(s.countDrafts[countId] ?? {}) };
      if (qty === null) delete draft[itemId];
      else draft[itemId] = qty;
      return { countDrafts: { ...s.countDrafts, [countId]: draft } };
    }),

  postCount: (countId) => {
    const state = get();
    const count = state.counts.find((c) => c.id === countId);
    if (count?.status !== 'open') throw new Error('That count is not open');

    // Expected is read now, at posting, not when the count started: whatever
    // moved in between is already in the ledger and must not count as variance.
    const ctx = ledgerContext();
    let batches = state.batches;
    const movements: StockMovement[] = [];
    const lines: StockCountLine[] = [];

    for (const [itemId, counted] of Object.entries(state.countDrafts[countId] ?? {})) {
      const result = countStock(
        {
          itemId,
          batches,
          countedQty: counted,
          fallbackUnitCost: fallbackUnitCost(itemId, batches),
          referenceId: countId,
        },
        ctx,
      );
      batches = upsert(batches, result.batches);
      movements.push(...result.movements);
      lines.push({
        id: ctx.newId(),
        countId,
        itemId,
        expectedQty: result.expectedQty,
        countedQty: result.countedQty,
        varianceValue: result.varianceValue,
        isOpening: result.isOpening,
      });
    }

    set((s) => {
      const { [countId]: _posted, ...countDrafts } = s.countDrafts;
      return {
        batches,
        movements: [...s.movements, ...movements],
        countLines: [...s.countLines, ...lines],
        counts: s.counts.map((c) =>
          c.id === countId ? { ...c, status: 'completed', completedAt: ctx.now } : c,
        ),
        countDrafts,
      };
    });
    return lines;
  },

  cancelCount: (countId) =>
    set((s) => {
      const { [countId]: _discarded, ...countDrafts } = s.countDrafts;
      return {
        counts: s.counts.map((c) => (c.id === countId ? { ...c, status: 'cancelled' } : c)),
        countDrafts,
      };
    }),
}));
