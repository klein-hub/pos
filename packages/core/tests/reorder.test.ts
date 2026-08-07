import { describe, expect, it } from '@jest/globals';
import {
  classifyMovement,
  dailyVelocity,
  daysOfCover,
  suggestParLevel,
  suggestReorder,
} from '../src/index.js';

/** Matcha Powder, straight off the spreadsheet: 1kg packs, 1 on hand, par 12. */
const matcha = {
  name: 'Matcha Powder',
  packSize: 1000,
  reorderPoint: 2000,
  parLevel: 12000,
  isSeasonal: false,
};

describe('reorder quantity', () => {
  it('fixes the spreadsheet formula that said -7 packs', () => {
    const result = suggestReorder({
      item: matcha,
      onHand: 1000,
      velocityPerDay: 142.857,
      leadTimeDays: 4,
    });
    expect(result.orderPurchaseUnits).toBe(11);
    expect(result.deficitBaseUnits).toBe(11000);
  });

  it('rounds up — you cannot buy part of a bottle', () => {
    const result = suggestReorder({
      item: { ...matcha, parLevel: 3500 },
      onHand: 1000,
      velocityPerDay: 10,
      leadTimeDays: 4,
    });
    // 2500g short of par, in 1kg packs.
    expect(result.orderPurchaseUnits).toBe(3);
  });

  it('marks an item critical when cover is shorter than the lead time', () => {
    const result = suggestReorder({
      item: matcha,
      onHand: 1000,
      velocityPerDay: 142.857,
      leadTimeDays: 10,
    });
    expect(result.status).toBe('critical');
    expect(result.urgent).toBe(true);
    expect(result.reason).toMatch(/order now/i);
  });

  it('does not order for something already well stocked', () => {
    const result = suggestReorder({
      item: matcha,
      onHand: 12000,
      velocityPerDay: 142.857,
      leadTimeDays: 4,
    });
    expect(result.status).toBe('ok');
    expect(result.orderPurchaseUnits).toBe(0);
  });

  it('warns about overstock on a perishable', () => {
    const result = suggestReorder({
      item: { ...matcha, shelfLifeDays: 60 },
      onHand: 20000,
      velocityPerDay: 142.857,
      leadTimeDays: 4,
    });
    expect(result.status).toBe('overstocked');
    expect(result.reason).toMatch(/spoilage/i);
  });

  it('reports being out of stock', () => {
    const result = suggestReorder({ item: matcha, onHand: 0, velocityPerDay: 50, leadTimeDays: 4 });
    expect(result.status).toBe('out');
    expect(result.orderPurchaseUnits).toBe(12);
  });

  it('rejects a par level below the reorder point', () => {
    expect(() =>
      suggestReorder({
        item: { ...matcha, parLevel: 1000, reorderPoint: 2000 },
        onHand: 500,
        velocityPerDay: 10,
        leadTimeDays: 4,
      }),
    ).toThrow(/par level/i);
  });
});

describe('velocity and movement speed', () => {
  it('averages consumption over the sampling window', () => {
    expect(dailyVelocity({ consumedBaseUnits: 4000, windowDays: 28 })).toBeCloseTo(142.857, 3);
  });

  it('classifies by how long one purchase unit lasts', () => {
    // A 1kg pack gone in a week.
    expect(classifyMovement({ packSize: 1000, isSeasonal: false }, 142.857)).toBe('fast');
    // A 2.5kg bottle lasting about four weeks.
    expect(classifyMovement({ packSize: 2500, isSeasonal: false }, 90)).toBe('moderate');
    // A 2.5kg bottle lasting half a year.
    expect(classifyMovement({ packSize: 2500, isSeasonal: false }, 14)).toBe('slow');
  });

  it('keeps seasonal as a deliberate override, not a measurement', () => {
    expect(classifyMovement({ packSize: 2500, isSeasonal: true }, 0)).toBe('seasonal');
  });

  it('calls out stock that never moves at all', () => {
    // Blueberry, orange, passion fruit: reordered by habit, sold by nobody.
    expect(classifyMovement({ packSize: 2500, isSeasonal: false }, 0)).toBe('dormant');
  });

  it('treats an unmoving item as having infinite cover, not zero', () => {
    expect(daysOfCover(1000, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(daysOfCover(1000, 100)).toBe(10);
  });
});

describe('par level suggestion', () => {
  it('sizes par from demand and lead time', () => {
    // Beans: ~1kg/day, 4-day lead time, 3 days of safety stock.
    expect(suggestParLevel(1000, 4, 3)).toBe(7000);
  });

  it('never suggests holding more than the shelf life allows', () => {
    // Roasted beans go stale in ~28 days; a 30-day cover would be worse than
    // a stockout. The old sheet capped beans at MAX 10 with 10 on hand.
    expect(suggestParLevel(1000, 20, 10)).toBe(30000);
    expect(suggestParLevel(1000, 20, 10, 28)).toBe(21000);
  });
});
