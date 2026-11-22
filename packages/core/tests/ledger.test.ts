import { describe, expect, it } from '@jest/globals';
import {
  consumeStock,
  countStock,
  openContainer,
  producePrep,
  receiveStock,
  reconcileLedger,
  recipeCost,
  resolveUnitCost,
  totalOnHand,
  type InventoryItem,
  type LedgerContext,
  type RecipeLine,
  type StockBatch,
  type StockMovement,
} from '../src/index.js';

function ledgerContext(): LedgerContext {
  let n = 0;
  return { newId: () => `id-${++n}`, actorId: 'owner', now: '2026-11-08T09:00:00.000Z' };
}

const item = (over: Partial<InventoryItem> & Pick<InventoryItem, 'id'>): InventoryItem => ({
  companyId: 'c',
  locationId: 'l',
  name: over.id,
  category: 'Test',
  itemType: 'raw_material',
  baseUnit: 'ml',
  purchaseUnit: 'Bottle',
  packSize: 1000,
  yieldPct: 1,
  reorderPoint: 0,
  parLevel: 0,
  isSeasonal: false,
  ...over,
});

const batch = (over: Partial<StockBatch> & Pick<StockBatch, 'id'>): StockBatch => ({
  itemId: 'milk',
  receivedAt: '2026-11-01',
  qtyReceived: 1000,
  qtyRemaining: 1000,
  unitCost: 0.072,
  isOpen: false,
  ...over,
});

/** Apply a change set the way the admin store does: upsert batches by id. */
function apply(batches: StockBatch[], change: { batches: StockBatch[] }): StockBatch[] {
  const next = new Map(batches.map((b) => [b.id, b]));
  for (const b of change.batches) next.set(b.id, b);
  return [...next.values()];
}

const milk = item({ id: 'milk', packSize: 1000 });
const beans = item({ id: 'beans', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, yieldPct: 0.97 });

describe('receiving stock', () => {
  it('creates one batch per line, costed per base unit, with a matching receipt movement', () => {
    const result = receiveStock(
      { lines: [{ item: milk, qtyPurchaseUnits: 4, linePrice: 288 }] },
      ledgerContext(),
    );

    expect(result.batches).toHaveLength(1);
    const b = result.batches[0]!;
    expect(b.qtyReceived).toBe(4000);
    expect(b.qtyRemaining).toBe(4000);
    expect(b.unitCost).toBeCloseTo(0.072, 6);
    expect(b.isOpen).toBe(false);

    expect(result.movements).toEqual([
      expect.objectContaining({ reason: 'receipt', qty: 4000, batchId: b.id, costAtTime: b.unitCost }),
    ]);
  });

  it('folds the delivery fee into each line by value, so nothing is lost or invented', () => {
    const syrup = item({ id: 'syrup', packSize: 2500 });
    const result = receiveStock(
      {
        deliveryFee: 188,
        lines: [
          { item: milk, qtyPurchaseUnits: 10, linePrice: 720 },
          { item: syrup, qtyPurchaseUnits: 2, linePrice: 660 },
        ],
      },
      ledgerContext(),
    );

    // Unit costs are held to 6dp, so 10 L of milk can drift by half a centavo — no more.
    const landed = result.batches.reduce((sum, b) => sum + b.qtyReceived * b.unitCost, 0);
    expect(Math.abs(landed - (720 + 660 + 188))).toBeLessThan(0.01);
    expect(result.lines.map((l) => l.allocatedDeliveryFee)).toEqual([
      expect.closeTo((720 / 1380) * 188, 6),
      expect.closeTo((660 / 1380) * 188, 6),
    ]);
    // Every movement of one receipt shares a reference, so it can be traced as one delivery.
    expect(new Set(result.movements.map((m) => m.referenceId)).size).toBe(1);
  });

  it('costs the physical unit and leaves yield loss to the recipe, so it is counted once', () => {
    const received = receiveStock(
      { lines: [{ item: beans, qtyPurchaseUnits: 1, linePrice: 620 }] },
      ledgerContext(),
    );
    expect(received.batches[0]!.unitCost).toBeCloseTo(0.62, 6);

    // An 18 g dose at 97% yield draws 18.56 g. Costed once: ₱11.51. Applying
    // yield at receipt as well would read ₱11.86 — 3% too high on every shot.
    const recipe: RecipeLine[] = [
      { id: 'r1', ownerId: 'shot', ownerType: 'variant', itemId: 'beans', dose: { qty: 18 } },
    ];
    const cost = recipeCost('shot', {
      getItem: (id) => (id === 'beans' ? beans : undefined),
      getItemUnitCost: (id) => resolveUnitCost(received.batches.filter((b) => b.itemId === id)).unitCost,
      getDosingUnits: () => [],
      getRecipeLines: (owner) => recipe.filter((l) => l.ownerId === owner),
    });
    expect(cost.total).toBeCloseTo((18 / 0.97) * 0.62, 4);
  });

  it('converts a label printed in a different unit using density', () => {
    const sauce = item({ id: 'sauce', packSize: 2000, densityGPerMl: 1.3 });
    const result = receiveStock(
      {
        lines: [{ item: sauce, qtyPurchaseUnits: 1, linePrice: 799, labelPackSize: 2500, labelUnit: 'g' }],
      },
      ledgerContext(),
    );
    // 2.5 kg of sauce at 1.3 g/ml is 1,923 ml.
    expect(result.batches[0]!.qtyReceived).toBeCloseTo(1923.0769, 4);
  });

  it('carries the purchase order and expiry onto the batch', () => {
    const result = receiveStock(
      {
        purchaseOrderId: 'po-1',
        lines: [{ item: milk, qtyPurchaseUnits: 1, linePrice: 72, expiryDate: '2026-11-20' }],
      },
      ledgerContext(),
    );
    expect(result.batches[0]).toMatchObject({ purchaseOrderId: 'po-1', expiryDate: '2026-11-20' });
  });

  it('rejects an empty receipt and a zero quantity', () => {
    expect(() => receiveStock({ lines: [] }, ledgerContext())).toThrow();
    expect(() =>
      receiveStock({ lines: [{ item: milk, qtyPurchaseUnits: 0, linePrice: 72 }] }, ledgerContext()),
    ).toThrow();
  });
});

describe('consuming stock', () => {
  const stock = [
    batch({ id: 'open', qtyRemaining: 300, unitCost: 0.07, isOpen: true }),
    batch({ id: 'sealed-soon', expiryDate: '2026-11-12', unitCost: 0.072 }),
    batch({ id: 'sealed-later', expiryDate: '2026-11-30', unitCost: 0.075 }),
  ];

  it('draws FEFO — the open container first — and costs each part at its own batch price', () => {
    const result = consumeStock({ itemId: 'milk', batches: stock, qty: 500, reason: 'waste', wasteKind: 'spill' }, ledgerContext());

    expect(result.movements.map((m) => [m.batchId, m.qty, m.costAtTime])).toEqual([
      ['open', -300, 0.07],
      ['sealed-soon', -200, 0.072],
    ]);
    expect(result.cost).toBeCloseTo(300 * 0.07 + 200 * 0.072, 6);
    expect(result.shortfall).toBe(0);
    expect(result.movements.every((m) => m.wasteKind === 'spill')).toBe(true);
  });

  it('opens the container it broke into and closes the one it emptied', () => {
    const result = consumeStock({ itemId: 'milk', batches: stock, qty: 500, reason: 'sale' }, ledgerContext());
    const after = apply(stock, result);

    expect(after.find((b) => b.id === 'open')).toMatchObject({ qtyRemaining: 0, isOpen: false });
    expect(after.find((b) => b.id === 'sealed-soon')).toMatchObject({ qtyRemaining: 800, isOpen: true });
    expect(after.filter((b) => b.isOpen)).toHaveLength(1);
  });

  it('writes off one named batch without touching the open container', () => {
    const result = consumeStock(
      { itemId: 'milk', batches: stock, qty: 1000, reason: 'waste', wasteKind: 'expired', batchId: 'sealed-soon' },
      ledgerContext(),
    );
    const after = apply(stock, result);

    expect(result.movements).toEqual([expect.objectContaining({ batchId: 'sealed-soon', qty: -1000 })]);
    expect(after.find((b) => b.id === 'open')).toMatchObject({ qtyRemaining: 300, isOpen: true });
  });

  it('reports a shortfall instead of inventing stock to cover it', () => {
    const result = consumeStock({ itemId: 'milk', batches: stock, qty: 2500, reason: 'sale' }, ledgerContext());
    expect(result.shortfall).toBe(200);
    expect(result.movements.reduce((s, m) => s + m.qty, 0)).toBe(-2300);
  });

  it('rejects a waste kind on anything that is not waste, and a non-positive quantity', () => {
    expect(() =>
      consumeStock({ itemId: 'milk', batches: stock, qty: 10, reason: 'staff', wasteKind: 'spill' }, ledgerContext()),
    ).toThrow(/waste/i);
    expect(() => consumeStock({ itemId: 'milk', batches: stock, qty: 0, reason: 'sale' }, ledgerContext())).toThrow();
  });
});

describe('physical counts', () => {
  it('posts shrinkage FEFO, valued at the batches it came out of', () => {
    const stock = [
      batch({ id: 'open', qtyRemaining: 500, unitCost: 0.07, isOpen: true }),
      batch({ id: 'sealed-a', unitCost: 0.072 }),
      batch({ id: 'sealed-b', unitCost: 0.072 }),
    ];
    // Expected 2,500 ml; on the shelf: 1 sealed and 300 ml in the open carton.
    const result = countStock({ itemId: 'milk', batches: stock, countedQty: 1300 }, ledgerContext());
    const after = apply(stock, result);

    expect(result.expectedQty).toBe(2500);
    expect(result.varianceQty).toBe(-1200);
    expect(result.varianceValue).toBeCloseTo(-(500 * 0.07 + 700 * 0.072), 6);
    expect(result.isOpening).toBe(false);
    expect(totalOnHand(after)).toBe(1300);
    // What the shelf shows: one carton open at 300 ml, one sealed.
    expect(after.filter((b) => b.isOpen).map((b) => b.qtyRemaining)).toEqual([300]);
  });

  it('puts found stock back into batches with room before creating a new one', () => {
    const stock = [
      batch({ id: 'open', qtyRemaining: 400, unitCost: 0.07, isOpen: true }),
      batch({ id: 'sealed', unitCost: 0.08 }),
    ];
    const result = countStock({ itemId: 'milk', batches: stock, countedQty: 1450 }, ledgerContext());
    const after = apply(stock, result);

    expect(result.varianceQty).toBe(50);
    expect(after.find((b) => b.id === 'open')?.qtyRemaining).toBe(450);
    expect(result.batches).toHaveLength(1);
    expect(result.varianceValue).toBeCloseTo(50 * 0.07, 6);
  });

  it('creates a batch at weighted-average cost for surplus that fits nowhere', () => {
    const stock = [batch({ id: 'full', unitCost: 0.08 })];
    const result = countStock({ itemId: 'milk', batches: stock, countedQty: 1200 }, ledgerContext());

    const created = result.batches.find((b) => b.id !== 'full');
    expect(created).toMatchObject({ qtyReceived: 200, qtyRemaining: 200, unitCost: 0.08 });
    expect(result.movements).toEqual([
      expect.objectContaining({ reason: 'count_adjustment', qty: 200, batchId: created?.id }),
    ]);
  });

  it('treats the first count of a never-stocked item as its opening balance', () => {
    const result = countStock(
      { itemId: 'milk', batches: [], countedQty: 3000, fallbackUnitCost: 0.072 },
      ledgerContext(),
    );
    expect(result.isOpening).toBe(true);
    expect(result.batches).toEqual([
      expect.objectContaining({ qtyRemaining: 3000, unitCost: 0.072 }),
    ]);
    expect(result.varianceValue).toBeCloseTo(216, 6);
  });

  it('posts nothing when the count matches, and rejects a negative count', () => {
    const stock = [batch({ id: 'a' })];
    const exact = countStock({ itemId: 'milk', batches: stock, countedQty: 1000 }, ledgerContext());
    expect(exact.movements).toEqual([]);
    expect(exact.varianceValue).toBe(0);
    expect(() => countStock({ itemId: 'milk', batches: stock, countedQty: -1 }, ledgerContext())).toThrow();
  });
});

describe('opening a container', () => {
  it('opens a sealed batch and closes an emptied one', () => {
    const stock = [
      batch({ id: 'empty', qtyRemaining: 0, isOpen: true }),
      batch({ id: 'next' }),
    ];
    const changed = openContainer(stock, 'next');
    expect(changed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'empty', isOpen: false }),
        expect.objectContaining({ id: 'next', isOpen: true }),
      ]),
    );
  });

  it('refuses while another container still has stock — one open at a time', () => {
    const stock = [batch({ id: 'current', qtyRemaining: 200, isOpen: true }), batch({ id: 'next' })];
    expect(() => openContainer(stock, 'next')).toThrow(/still open/i);
  });

  it('refuses to open an empty batch', () => {
    expect(() => openContainer([batch({ id: 'gone', qtyRemaining: 0 })], 'gone')).toThrow();
  });
});

describe('prep production', () => {
  const cake = item({ id: 'cheesecake', itemType: 'sub_assembly', baseUnit: 'each', prepYieldQty: 12 });
  const creamCheese = item({ id: 'cream-cheese', baseUnit: 'g', packSize: 1000 });
  const egg = item({ id: 'egg', baseUnit: 'each', packSize: 1 });
  const items = [cake, creamCheese, egg];
  const lines: RecipeLine[] = [
    { id: 'p1', ownerId: 'cheesecake', ownerType: 'prep', itemId: 'cream-cheese', dose: { qty: 1250 } },
    { id: 'p2', ownerId: 'cheesecake', ownerType: 'prep', itemId: 'egg', dose: { qty: 6 } },
  ];
  const listPrice: Record<string, number> = { 'cream-cheese': 0.535, egg: 7 };
  const stock = [
    batch({ id: 'cc', itemId: 'cream-cheese', qtyReceived: 2000, qtyRemaining: 2000, unitCost: 0.535 }),
    batch({ id: 'eggs', itemId: 'egg', qtyReceived: 30, qtyRemaining: 30, unitCost: 7 }),
  ];

  const run = (batches: StockBatch[], runs = 1) =>
    producePrep(
      {
        item: cake,
        runs,
        lines,
        getItem: (id) => items.find((i) => i.id === id),
        getBatches: (id) => batches.filter((b) => b.itemId === id),
        fallbackUnitCost: (id) => listPrice[id],
      },
      ledgerContext(),
    );

  it('consumes the ingredients and produces a batch at what they actually cost', () => {
    const result = run(stock);
    const produced = result.batches.find((b) => b.itemId === 'cheesecake');

    expect(result.producedQty).toBe(12);
    expect(result.totalCost).toBeCloseTo(1250 * 0.535 + 6 * 7, 6);
    expect(produced).toMatchObject({ qtyReceived: 12, qtyRemaining: 12 });
    expect(produced?.unitCost).toBeCloseTo((1250 * 0.535 + 6 * 7) / 12, 6);
    expect(result.movements.filter((m) => m.reason === 'prep_consume')).toHaveLength(2);
    expect(result.movements.filter((m) => m.reason === 'prep_produce')).toEqual([
      expect.objectContaining({ qty: 12, batchId: produced?.id }),
    ]);
  });

  it('matches the theoretical recipe cost when stock is priced at the list', () => {
    const theoretical = recipeCost('cheesecake', {
      getItem: (id) => items.find((i) => i.id === id),
      getItemUnitCost: (id) => listPrice[id],
      getDosingUnits: () => [],
      getRecipeLines: (owner) => lines.filter((l) => l.ownerId === owner),
    });
    expect(run(stock).totalCost).toBeCloseTo(theoretical.total, 6);
  });

  it('costs an unrecorded ingredient at its fallback and reports it, rather than costing it at zero', () => {
    const result = run([stock[1]!]);
    expect(result.shortfalls).toEqual([{ itemId: 'cream-cheese', qty: 1250, costedAt: 0.535 }]);
    expect(result.totalCost).toBeCloseTo(1250 * 0.535 + 6 * 7, 6);
  });

  it('refuses to produce something that is not a prep item', () => {
    expect(() =>
      producePrep(
        {
          item: creamCheese,
          runs: 1,
          lines: [],
          getItem: () => undefined,
          getBatches: () => [],
          fallbackUnitCost: () => undefined,
        },
        ledgerContext(),
      ),
    ).toThrow(/prep item/i);
  });
});

describe('ledger reconciliation', () => {
  it('stays reconciled through a receive, a sale, a count and a write-off', () => {
    const ctx = ledgerContext();
    let batches: StockBatch[] = [];
    const movements: StockMovement[] = [];
    const record = (change: { batches: StockBatch[]; movements: StockMovement[] }) => {
      batches = apply(batches, change);
      movements.push(...change.movements);
    };

    record(receiveStock({ lines: [{ item: milk, qtyPurchaseUnits: 3, linePrice: 216, expiryDate: '2026-11-15' }] }, ctx));
    record(receiveStock({ lines: [{ item: milk, qtyPurchaseUnits: 2, linePrice: 150, expiryDate: '2026-11-25' }] }, ctx));
    record(consumeStock({ itemId: 'milk', batches, qty: 1234.5, reason: 'sale' }, ctx));
    record(countStock({ itemId: 'milk', batches, countedQty: 3600 }, ctx));
    record(consumeStock({ itemId: 'milk', batches, qty: 100, reason: 'waste', wasteKind: 'spoiled' }, ctx));

    expect(reconcileLedger(batches, movements)).toEqual([]);
    expect(totalOnHand(batches)).toBe(3500);
  });

  it('flags a batch whose quantity no longer matches its movements', () => {
    const ctx = ledgerContext();
    const received = receiveStock({ lines: [{ item: milk, qtyPurchaseUnits: 1, linePrice: 72 }] }, ctx);
    const tampered = received.batches.map((b) => ({ ...b, qtyRemaining: 900 }));

    expect(reconcileLedger(tampered, received.movements)).toEqual([
      expect.objectContaining({ qtyRemaining: 900, ledgerQty: 1000 }),
    ]);
  });
});

describe('cost source', () => {
  it('falls back from live stock, to the last batch, to the price list', () => {
    expect(resolveUnitCost([batch({ id: 'a', unitCost: 0.08 })], 0.072)).toEqual({ unitCost: 0.08, source: 'batch' });
    expect(resolveUnitCost([batch({ id: 'a', unitCost: 0.08, qtyRemaining: 0 })], 0.072)).toEqual({
      unitCost: 0.08,
      source: 'last_batch',
    });
    expect(resolveUnitCost([], 0.072)).toEqual({ unitCost: 0.072, source: 'standard' });
    expect(resolveUnitCost([])).toEqual({ unitCost: undefined, source: 'none' });
  });
});
