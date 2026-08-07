import { describe, expect, it } from '@jest/globals';
import {
  MAX_RECIPE_DEPTH,
  recipeCost,
  variantCost,
  type CostingContext,
  type DosingUnit,
  type InventoryItem,
  type RecipeLine,
} from '../src/index.js';

const item = (
  id: string,
  over: Partial<InventoryItem> = {},
): InventoryItem => ({
  id,
  companyId: 'c1',
  locationId: 'l1',
  name: id,
  category: 'test',
  itemType: 'raw_material',
  baseUnit: 'g',
  purchaseUnit: 'Pack',
  packSize: 1000,
  yieldPct: 1,
  reorderPoint: 0,
  parLevel: 0,
  isSeasonal: false,
  ...over,
});

const line = (ownerId: string, itemId: string, qty: number, dosingUnitId?: string): RecipeLine => ({
  id: `${ownerId}:${itemId}`,
  ownerId,
  ownerType: 'variant',
  itemId,
  dose: dosingUnitId ? { qty, dosingUnitId } : { qty },
});

interface Fixture {
  items: InventoryItem[];
  costs: Record<string, number>;
  lines: RecipeLine[];
  dosingUnits?: DosingUnit[];
}

function context({ items, costs, lines, dosingUnits = [] }: Fixture): CostingContext {
  return {
    getItem: (id) => items.find((i) => i.id === id),
    getItemUnitCost: (id) => costs[id],
    getDosingUnits: (id) => dosingUnits.filter((u) => u.itemId === id),
    getRecipeLines: (ownerId) => lines.filter((l) => l.ownerId === ownerId),
  };
}

/** An iced latte built the way the shop actually builds it. */
const latte = (): Fixture => ({
  items: [
    item('beans'),
    item('espresso', { itemType: 'sub_assembly', prepYieldQty: 36 }),
    item('milk', { baseUnit: 'ml' }),
    item('cup16', { baseUnit: 'each', purchaseUnit: 'Pack', packSize: 50 }),
    item('lid', { baseUnit: 'each', purchaseUnit: 'Pack', packSize: 100 }),
  ],
  costs: { beans: 0.62, milk: 0.09, cup16: 4.5, lid: 1.8 },
  lines: [
    // Prep: an 18g dose pulls 36g of espresso.
    { ...line('espresso', 'beans', 18), ownerType: 'prep' },
    line('latte16', 'espresso', 36),
    line('latte16', 'milk', 180),
    line('latte16', 'cup16', 1),
    line('latte16', 'lid', 1),
  ],
});

describe('recipe roll-up', () => {
  it('costs a drink through its sub-assembly', () => {
    const result = recipeCost('latte16', context(latte()));

    // beans 18g x ₱0.62 = ₱11.16 for 36g of espresso => ₱0.31/g
    // espresso 11.16 + milk 16.20 + cup 4.50 + lid 1.80
    expect(result.total).toBeCloseTo(33.66, 6);
    expect(result.warnings).toHaveLength(0);

    const espresso = result.lines.find((l) => l.itemId === 'espresso');
    expect(espresso?.unitCost).toBeCloseTo(0.31, 6);
    expect(espresso?.children?.[0]?.itemId).toBe('beans');
  });

  it('shows packaging as a real share of cost', () => {
    const result = recipeCost('latte16', context(latte()));
    const packaging = result.lines
      .filter((l) => l.itemId === 'cup16' || l.itemId === 'lid')
      .reduce((sum, l) => sum + l.cost, 0);
    // ₱6.30 of a ₱33.66 drink — the part the old spreadsheet tracked nowhere.
    expect(packaging / result.total).toBeGreaterThan(0.18);
  });

  it('draws extra stock to cover yield loss', () => {
    const fixture = latte();
    fixture.items = fixture.items.map((i) => (i.id === 'beans' ? { ...i, yieldPct: 0.97 } : i));
    const result = recipeCost('espresso', context(fixture));

    // 18g in the cup needs 18 / 0.97 = 18.5567g off the shelf.
    expect(result.lines[0]?.effectiveQty).toBeCloseTo(18.556701, 6);
    expect(result.total).toBeCloseTo(11.505155, 6);
  });

  it('converts pumps to grams using the calibration', () => {
    const fixture: Fixture = {
      items: [item('lychee', { packSize: 2500 })],
      costs: { lychee: 0.36 },
      lines: [line('lycheeTea', 'lychee', 2, 'pump-lychee')],
      dosingUnits: [
        { id: 'pump-lychee', itemId: 'lychee', name: 'pump', baseQtyPerUnit: 9, isDefault: true },
      ],
    };
    const result = recipeCost('lycheeTea', context(fixture));
    expect(result.lines[0]?.qty).toBe(18);
    expect(result.total).toBeCloseTo(6.48, 6);
  });

  it('warns instead of throwing when a pump was never calibrated', () => {
    const fixture: Fixture = {
      items: [item('lychee')],
      costs: { lychee: 0.36 },
      lines: [line('lycheeTea', 'lychee', 2, 'pump-lychee')],
      dosingUnits: [
        { id: 'pump-lychee', itemId: 'lychee', name: 'pump', baseQtyPerUnit: 0, isDefault: true },
      ],
    };
    const result = recipeCost('lycheeTea', context(fixture));
    expect(result.total).toBe(0);
    expect(result.warnings[0]).toMatch(/calibrate/i);
  });

  it('flags an item with no cost on record rather than costing it at zero silently', () => {
    const fixture = latte();
    delete fixture.costs['milk'];
    const result = recipeCost('latte16', context(fixture));
    expect(result.warnings.join(' ')).toMatch(/milk has no cost on record/i);
    expect(result.total).toBeCloseTo(17.46, 6);
  });

  it('refuses a recipe that contains itself', () => {
    const fixture: Fixture = {
      items: [item('syrup', { itemType: 'sub_assembly', prepYieldQty: 100 })],
      costs: {},
      lines: [{ ...line('syrup', 'syrup', 10), ownerType: 'prep' }],
    };
    expect(() => recipeCost('syrup', context(fixture))).toThrow(/circular/i);
  });

  it('stops runaway nesting', () => {
    const depth = MAX_RECIPE_DEPTH + 2;
    const items: InventoryItem[] = [];
    const lines: RecipeLine[] = [];
    for (let i = 0; i < depth; i++) {
      items.push(item(`s${i}`, { itemType: 'sub_assembly', prepYieldQty: 10 }));
      lines.push({ ...line(`s${i}`, `s${i + 1}`, 1), ownerType: 'prep' });
    }
    items.push(item(`s${depth}`));
    expect(() => recipeCost('s0', context({ items, costs: { [`s${depth}`]: 1 }, lines }))).toThrow(
      /nesting/i,
    );
  });
});

describe('modifiers', () => {
  it('adds the real cost of an add-on, not a flat guess', () => {
    const fixture = latte();
    fixture.lines.push({ ...line('mod-extra-shot', 'espresso', 36), ownerType: 'modifier' });

    const plain = variantCost('latte16', [], context(fixture));
    const withShot = variantCost('latte16', ['mod-extra-shot'], context(fixture));

    expect(withShot.total - plain.total).toBeCloseTo(11.16, 6);
  });

  it('costs a milk swap as a swap, not an addition', () => {
    const fixture = latte();
    fixture.items.push(item('oat', { baseUnit: 'ml' }));
    fixture.costs['oat'] = 0.16;
    // Remove the dairy, add the oat.
    fixture.lines.push(
      { ...line('mod-oat', 'milk', -180), ownerType: 'modifier' },
      { ...line('mod-oat', 'oat', 180), ownerType: 'modifier' },
    );

    const withOat = variantCost('latte16', ['mod-oat'], context(fixture));
    // 180ml swapped from ₱0.09 to ₱0.16 = ₱12.60 more.
    expect(withOat.total).toBeCloseTo(33.66 + 12.6, 6);
  });
});
