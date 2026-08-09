import { describe, expect, it } from '@jest/globals';
import {
  openingCostMap,
  openingCosts,
  recipeCost,
  unitCostOf,
  type CostingContext,
  type InventoryItem,
  type RecipeLine,
} from '../src/index.js';

/**
 * Builds a costing context straight from the opening price list, so these tests
 * exercise the engine against the shop's real numbers rather than fixtures.
 */
function seedContext(extra: {
  subAssemblies?: { name: string; yield: number }[];
  lines: { owner: string; item: string; qty: number }[];
}): CostingContext {
  const costs = openingCostMap();
  const subs = new Map((extra.subAssemblies ?? []).map((s) => [s.name, s.yield]));

  const items = new Map<string, InventoryItem>();
  const register = (name: string, itemType: InventoryItem['itemType'], prepYieldQty?: number) => {
    const seed = openingCosts.find((i) => i.name === name);
    items.set(name, {
      id: name,
      companyId: 'c1',
      locationId: 'l1',
      name,
      category: seed?.category ?? 'Prepared',
      itemType,
      baseUnit: seed?.baseUnit ?? 'each',
      purchaseUnit: seed?.purchaseUnit ?? 'Batch',
      packSize: seed?.packSize ?? 1,
      yieldPct: 1,
      reorderPoint: 0,
      parLevel: 0,
      isSeasonal: false,
      ...(prepYieldQty !== undefined ? { prepYieldQty } : {}),
    });
  };

  for (const seed of openingCosts) register(seed.name, 'raw_material');
  for (const [name, y] of subs) register(name, 'sub_assembly', y);

  const lines: RecipeLine[] = extra.lines.map((l, index) => ({
    id: `line-${index}`,
    ownerId: l.owner,
    ownerType: 'variant',
    itemId: l.item,
    dose: { qty: l.qty },
  }));

  return {
    getItem: (id) => items.get(id),
    getItemUnitCost: (id) => costs[id],
    getDosingUnits: () => [],
    getRecipeLines: (ownerId) => lines.filter((l) => l.ownerId === ownerId),
  };
}

describe('opening price list', () => {
  it('derives per-unit cost at full precision, not the sheet’s 2dp', () => {
    const costs = openingCostMap();
    // The sheet rounded milk to PHP 0.07, understating every milk drink by 2.8%.
    expect(costs['Fresh Milk']).toBeCloseTo(0.072, 6);
    expect(costs['White Sugar']).toBeCloseTo(0.104, 6);
    expect(costs['Benguet Arabica Beans']).toBeCloseTo(0.566, 6);
    expect(costs['16 Oz Cup']).toBeCloseTo(2.55, 6);
  });

  it('does not carry over the sugar qty typo from the older sheet', () => {
    // The old sheet read 100.25 / 100g, i.e. PHP 1,002.50/kg — a 9.6x error.
    expect(unitCostOf(openingCosts.find((i) => i.name === 'White Sugar')!)).toBeLessThan(0.2);
  });

  it('has no duplicate names and no non-positive prices', () => {
    const names = openingCosts.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    for (const item of openingCosts) {
      expect(item.packPrice).toBeGreaterThan(0);
      expect(item.packSize).toBeGreaterThan(0);
    }
  });

  it('flags the two chocolate sauces as genuinely different costs', () => {
    const costs = openingCostMap();
    const a = costs['Chocolate Sauce']!;
    const b = costs['Catcher Choco Sauce']!;
    expect(Math.abs(a - b) / b).toBeGreaterThan(0.3);
  });
});

describe('batch-produced sellables (the cheesecake pattern)', () => {
  // A cake is prepped once and sold by the slice: a sub-assembly whose base
  // unit is "each" and whose prep recipe yields 12 of them.
  const ctx = seedContext({
    subAssemblies: [{ name: 'Cheesecake', yield: 12 }],
    lines: [
      { owner: 'Cheesecake', item: 'Cream Cheese', qty: 1250 },
      { owner: 'Cheesecake', item: 'Refined Sugar', qty: 675 },
      { owner: 'Cheesecake', item: 'Flour', qty: 47 },
      { owner: 'Cheesecake', item: 'Whipped Cream (Bakery)', qty: 150 },
      { owner: 'Cheesecake', item: 'Egg', qty: 6 },
      { owner: 'Cheesecake', item: 'Crushed Graham', qty: 300 },
      { owner: 'Cheesecake', item: 'Salted Butter', qty: 150 },
      // The sellable slice: one slice of cake, plus the packaging the sheet
      // priced but never attached to a recipe.
      { owner: 'slice', item: 'Cheesecake', qty: 1 },
      { owner: 'slice', item: 'Hamburger Box', qty: 1 },
      { owner: 'slice', item: 'Wooden Fork', qty: 1 },
    ],
  });

  it('costs the batch correctly, eggs included', () => {
    // The source sheet showed PHP 964.64 because the egg row displayed its
    // per-unit price instead of qty x price.
    expect(recipeCost('Cheesecake', ctx).total).toBeCloseTo(1006.62, 2);
  });

  it('is 4.2% more than the sheet said', () => {
    const correct = recipeCost('Cheesecake', ctx).total;
    expect((correct - 964.64) / correct).toBeCloseTo(0.0417, 3);
  });

  it('divides a batch into per-slice cost', () => {
    const slice = recipeCost('slice', ctx);
    const cake = slice.lines.find((l) => l.itemId === 'Cheesecake');
    expect(cake?.unitCost).toBeCloseTo(83.885, 2);
    expect(slice.total).toBeCloseTo(87.37, 2);
  });

  it('shows packaging as a non-trivial share of a slice', () => {
    const slice = recipeCost('slice', ctx);
    const packaging = slice.lines
      .filter((l) => l.itemId === 'Hamburger Box' || l.itemId === 'Wooden Fork')
      .reduce((sum, l) => sum + l.cost, 0);
    expect(packaging).toBeCloseTo(3.48, 2);
    expect(packaging / slice.total).toBeGreaterThan(0.03);
  });
});

describe('a real drink at real prices', () => {
  const ctx = seedContext({
    lines: [
      { owner: 'latte16', item: 'Benguet Arabica Beans', qty: 18 },
      { owner: 'latte16', item: 'Fresh Milk', qty: 180 },
      { owner: 'latte16', item: '16 Oz Cup', qty: 1 },
    ],
  });

  it('costs an iced latte from the shop’s own price list', () => {
    // 18g beans 10.19 + 180ml milk 12.96 + cup 2.55
    expect(recipeCost('latte16', ctx).total).toBeCloseTo(25.7, 2);
  });

  it('would understate by 2.5% at the sheet’s rounded milk price', () => {
    const real = recipeCost('latte16', ctx).total;
    const rounded = 18 * 0.566 + 180 * 0.07 + 2.55;
    expect((real - rounded) / real).toBeGreaterThan(0.013);
  });
});
