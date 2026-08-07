import { describe, expect, it } from '@jest/globals';
import {
  allocateDeliveryFee,
  expiryStatus,
  fefoOrder,
  landedUnitCost,
  packSizeInBaseUnits,
  planConsumption,
  totalOnHand,
  weightedAverageUnitCost,
  type StockBatch,
} from '../src/index.js';

const batch = (over: Partial<StockBatch> & Pick<StockBatch, 'id'>): StockBatch => ({
  itemId: 'caramel',
  receivedAt: '2026-08-01',
  qtyReceived: 2000,
  qtyRemaining: 2000,
  unitCost: 0.25,
  isOpen: false,
  ...over,
});

describe('landed cost', () => {
  it('folds the delivery fee into the per-base-unit cost', () => {
    // 2 x 2L bottles of caramel sauce at ₱450, ₱188 delivery.
    expect(
      landedUnitCost({
        qtyPurchaseUnits: 2,
        packSizeBaseUnits: 2000,
        linePrice: 900,
        allocatedDeliveryFee: 188,
      }),
    ).toBeCloseTo(0.272, 6);
  });

  it('raises usable cost when yield is lost', () => {
    // 1kg of beans at ₱620 with 3% lost to grinder retention and purge.
    const withoutLoss = landedUnitCost({ qtyPurchaseUnits: 1, packSizeBaseUnits: 1000, linePrice: 620 });
    const withLoss = landedUnitCost({
      qtyPurchaseUnits: 1,
      packSizeBaseUnits: 1000,
      linePrice: 620,
      yieldPct: 0.97,
    });
    expect(withoutLoss).toBeCloseTo(0.62, 6);
    expect(withLoss).toBeCloseTo(0.639175, 6);
    expect(withLoss).toBeGreaterThan(withoutLoss);
  });

  it('rejects impossible inputs rather than producing a silent zero', () => {
    expect(() => landedUnitCost({ qtyPurchaseUnits: 0, packSizeBaseUnits: 1000, linePrice: 620 })).toThrow();
    expect(() =>
      landedUnitCost({ qtyPurchaseUnits: 1, packSizeBaseUnits: 1000, linePrice: 620, yieldPct: 0 }),
    ).toThrow();
    expect(() =>
      landedUnitCost({ qtyPurchaseUnits: 1, packSizeBaseUnits: 1000, linePrice: 620, yieldPct: 1.4 }),
    ).toThrow();
  });

  it('allocates a delivery fee by line value', () => {
    expect(allocateDeliveryFee([900, 300], 188)).toEqual([141, 47]);
  });

  it('splits the fee evenly when every line is free', () => {
    expect(allocateDeliveryFee([0, 0], 188)).toEqual([94, 94]);
  });
});

describe('unit conversion', () => {
  const sauce = { packSize: 2000, baseUnit: 'ml' as const, densityGPerMl: 1.3 };

  it('passes through when the label unit matches the base unit', () => {
    expect(packSizeInBaseUnits(sauce, 'ml')).toBe(2000);
  });

  it('bridges mass and volume with density', () => {
    // A 2.5kg bottle held in ml.
    expect(packSizeInBaseUnits({ ...sauce, packSize: 2500 }, 'g')).toBeCloseTo(1923.0769, 4);
  });

  it('refuses to convert without a density', () => {
    expect(() => packSizeInBaseUnits({ packSize: 2500, baseUnit: 'ml' }, 'g')).toThrow(/density/i);
  });

  it('refuses to treat countables as weighable', () => {
    expect(() => packSizeInBaseUnits({ packSize: 50, baseUnit: 'each' }, 'g')).toThrow(/commensurable/);
  });
});

describe('stock valuation', () => {
  it('weights cost by what is actually left, not by what was bought', () => {
    const batches = [
      batch({ id: 'a', qtyReceived: 2000, qtyRemaining: 1000, unitCost: 0.25 }),
      batch({ id: 'b', qtyReceived: 4000, qtyRemaining: 3000, unitCost: 0.3 }),
    ];
    expect(totalOnHand(batches)).toBe(4000);
    expect(weightedAverageUnitCost(batches)).toBeCloseTo(0.2875, 6);
  });

  it('falls back to the last known price when stock is zero', () => {
    // Reporting 0 here would show an impossible 100% margin on the menu.
    const batches = [
      batch({ id: 'a', qtyRemaining: 0, unitCost: 0.25, receivedAt: '2026-07-01' }),
      batch({ id: 'b', qtyRemaining: 0, unitCost: 0.31, receivedAt: '2026-08-01' }),
    ];
    expect(weightedAverageUnitCost(batches)).toBeCloseTo(0.31, 6);
  });
});

describe('FEFO consumption', () => {
  it('finishes the open container before breaking a sealed one', () => {
    const batches = [
      batch({ id: 'sealed', expiryDate: '2026-09-01', qtyRemaining: 2000, unitCost: 0.3 }),
      batch({ id: 'open', expiryDate: '2026-11-01', qtyRemaining: 820, unitCost: 0.25, isOpen: true }),
    ];
    expect(fefoOrder(batches).map((b) => b.id)).toEqual(['open', 'sealed']);
  });

  it('orders sealed stock by soonest expiry, undated last', () => {
    const batches = [
      batch({ id: 'undated', qtyRemaining: 100 }),
      batch({ id: 'late', expiryDate: '2026-12-01', qtyRemaining: 100 }),
      batch({ id: 'soon', expiryDate: '2026-08-20', qtyRemaining: 100 }),
    ];
    expect(fefoOrder(batches).map((b) => b.id)).toEqual(['soon', 'late', 'undated']);
  });

  it('costs a draw across batch boundaries at each batch price', () => {
    const batches = [
      batch({ id: 'open', qtyRemaining: 100, unitCost: 0.25, isOpen: true }),
      batch({ id: 'next', qtyRemaining: 2000, unitCost: 0.3 }),
    ];
    const plan = planConsumption(batches, 180);
    expect(plan.allocations).toEqual([
      { batchId: 'open', qty: 100, unitCost: 0.25, cost: 25 },
      { batchId: 'next', qty: 80, unitCost: 0.3, cost: 24 },
    ]);
    expect(plan.totalCost).toBeCloseTo(49, 6);
    expect(plan.shortfall).toBe(0);
  });

  it('reports a shortfall instead of blocking the sale', () => {
    // Records lag reality at a busy counter; the sale still completes and the
    // gap surfaces at the next physical count.
    const plan = planConsumption([batch({ id: 'a', qtyRemaining: 50, unitCost: 0.2 })], 180);
    expect(plan.shortfall).toBe(130);
    expect(plan.allocations).toHaveLength(1);
  });

  it('ignores empty batches entirely', () => {
    const plan = planConsumption([batch({ id: 'empty', qtyRemaining: 0 })], 10);
    expect(plan.allocations).toHaveLength(0);
    expect(plan.shortfall).toBe(10);
  });
});

describe('expiry', () => {
  const today = new Date('2026-08-07T00:00:00Z');

  it('buckets by days remaining', () => {
    expect(expiryStatus(batch({ id: 'a', expiryDate: '2026-08-01' }), today)).toBe('expired');
    expect(expiryStatus(batch({ id: 'b', expiryDate: '2026-08-09' }), today)).toBe('critical');
    expect(expiryStatus(batch({ id: 'c', expiryDate: '2026-08-18' }), today)).toBe('warning');
    expect(expiryStatus(batch({ id: 'd', expiryDate: '2026-10-01' }), today)).toBe('ok');
    expect(expiryStatus(batch({ id: 'e' }), today)).toBe('unknown');
  });
});
