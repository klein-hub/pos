import { describe, expect, it } from '@jest/globals';
import {
  allocateCentavos,
  buildSeedCatalog,
  quoteSale,
  saleDraws,
  settleTenders,
  statutoryDiscount,
  summariseShift,
  type CostingContext,
  type InventoryItem,
  type OrderLine,
  type PricingCatalog,
  type RecipeLine,
} from '../src/index.js';

/** The seed catalog the POS runs on, wired up the way the app wires it. */
function seed() {
  const catalog = buildSeedCatalog();
  const pricing: PricingCatalog = {
    getVariant: (id) => catalog.variants.find((v) => v.id === id),
    getModifier: (id) => catalog.modifiers.find((m) => m.id === id),
  };
  const costing: CostingContext = {
    getItem: (id) => catalog.items.find((i) => i.id === id),
    getItemUnitCost: (id) => catalog.unitCosts[id],
    getDosingUnits: () => [],
    getRecipeLines: (ownerId) => catalog.recipeLines.filter((l) => l.ownerId === ownerId),
  };
  return { catalog, pricing, costing };
}

const latte16: OrderLine = { variantId: 'iced-latte-16oz', modifierIds: [], qty: 1 };
const senior = { kind: 'senior' as const, idNumber: 'SC-12345', holderName: 'Test Holder' };

describe('allocateCentavos', () => {
  it('always sums to the whole', () => {
    const weights = [16000, 13000, 18500, 9500, 15000, 7];
    for (let total = 0; total <= 3000; total += 7) {
      const parts = allocateCentavos(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      parts.forEach((p) => expect(Number.isInteger(p)).toBe(true));
    }
  });

  it('gives leftover centavos to the largest remainders, earlier line on a tie', () => {
    expect(allocateCentavos(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateCentavos(10, [1, 2])).toEqual([3, 7]);
  });

  it('splits evenly when there is nothing to weigh by', () => {
    expect(allocateCentavos(5, [0, 0])).toEqual([3, 2]);
    expect(allocateCentavos(5, [])).toEqual([]);
  });

  it('refuses fractional centavos', () => {
    expect(() => allocateCentavos(10.5, [1])).toThrow();
  });
});

describe('quoteSale', () => {
  const { pricing, costing } = seed();

  it('extracts VAT from the menu price', () => {
    const quote = quoteSale([latte16], pricing, costing);
    expect(quote.subtotal).toBe(16000);
    expect(quote.vatableSales).toBe(14286);
    expect(quote.vatAmount).toBe(1714);
    expect(quote.total).toBe(16000);
    expect(quote.lines[0]?.lineVat).toBe(1714);
  });

  it('prices and costs an add-on through its own recipe', () => {
    const plain = quoteSale([latte16], pricing, costing).lines[0]!;
    const withShot = quoteSale(
      [{ ...latte16, modifierIds: ['iced-latte-extra-shot'] }],
      pricing,
      costing,
    ).lines[0]!;

    expect(withShot.unitPrice).toBe(plain.unitPrice + 4000);
    // 36 ml of espresso is 18 g of beans at ₱0.566/g.
    expect(withShot.modifierCosts['iced-latte-extra-shot']).toBeCloseTo(10.188, 6);
    expect(withShot.unitCost).toBeCloseTo(plain.unitCost + 10.188, 6);
  });

  it('allocates line VAT that adds up to the VAT line exactly', () => {
    const quote = quoteSale(
      [
        { variantId: 'iced-latte-12oz', modifierIds: [], qty: 3 },
        { variantId: 'iced-americano-16oz', modifierIds: ['iced-americano-caramel-drizzle'], qty: 1 },
        { variantId: 'cheesecake-slice-slice', modifierIds: [], qty: 2 },
        { variantId: 'mango-float-cup', modifierIds: [], qty: 1 },
      ],
      pricing,
      costing,
    );
    expect(quote.lines.reduce((s, l) => s + l.lineVat, 0)).toBe(quote.vatAmount);
    expect(quote.lines.reduce((s, l) => s + l.lineGross, 0)).toBe(quote.subtotal);
  });

  it('snapshots theoretical COGS per unit and for the order', () => {
    const quote = quoteSale([{ ...latte16, qty: 2 }, { variantId: 'mango-float-cup', modifierIds: [], qty: 1 }], pricing, costing);
    const [a, b] = quote.lines;
    expect(quote.costTotal).toBeCloseTo(a!.unitCost * 2 + b!.unitCost, 6);
    expect(a!.unitCost).toBeGreaterThan(0);
  });

  it('matches the statutory calculation for a solo senior', () => {
    const quote = quoteSale([latte16], pricing, costing, senior);
    const statutory = statutoryDiscount({ ...senior, gross: 16000 });

    expect(quote.total).toBe(statutory.payable);
    expect(quote.total).toBe(11429);
    expect(quote.vatAmount).toBe(0);
    expect(quote.vatableSales).toBe(0);
    expect(quote.vatExemptSales).toBe(14286);
    expect(quote.discountTotal).toBe(1714 + 2857);
    expect(quote.discount?.idNumber).toBe('SC-12345');
  });

  it('keeps the non-senior share of a group bill VATable', () => {
    const quote = quoteSale(
      [{ variantId: 'iced-latte-16oz', modifierIds: [], qty: 1 }, { variantId: 'iced-americano-16oz', modifierIds: [], qty: 1 }, { variantId: 'iced-latte-12oz', modifierIds: [], qty: 1 }],
      pricing,
      costing,
      { ...senior, totalPax: 2, qualifiedPax: 1 },
    );
    // ₱420 split two ways: ₱210 is VATable, ₱210 is exempt and discounted.
    expect(quote.subtotal).toBe(42000);
    expect(quote.vatableSales + quote.vatAmount).toBe(21000);
    expect(quote.vatAmount).toBe(2250);
    expect(quote.vatExemptSales).toBe(18750);
    expect(quote.total).toBe(21000 + 18750 - 3750);
  });

  it('reconciles the receipt breakdown at any total and pax split', () => {
    for (let qty = 1; qty <= 12; qty++) {
      for (const [totalPax, qualifiedPax] of [[1, 1], [2, 1], [3, 1], [3, 2], [4, 3]] as const) {
        const quote = quoteSale(
          [{ ...latte16, qty }, { variantId: 'mango-float-cup', modifierIds: [], qty: 1 }],
          pricing,
          costing,
          { ...senior, totalPax, qualifiedPax },
        );
        const statutory = statutoryDiscount({ ...senior, gross: quote.subtotal, totalPax, qualifiedPax });

        expect(quote.total).toBe(statutory.payable);
        expect(quote.vatExemption).toBe(statutory.vatExempt);
        expect(quote.exemptDiscount).toBe(statutory.discount);
        expect(quote.vatableSales + quote.vatAmount + quote.vatExemptSales - quote.exemptDiscount).toBe(quote.total);
        expect(quote.lines.reduce((s, l) => s + l.lineDiscount, 0)).toBe(quote.discountTotal);
        expect(quote.lines.reduce((s, l) => s + l.lineVat, 0)).toBe(quote.vatAmount);
      }
    }
  });

  it('prices an empty order at zero', () => {
    const quote = quoteSale([], pricing, costing);
    expect(quote.total).toBe(0);
    expect(quote.lines).toEqual([]);
  });

  it('refuses what a till should never send', () => {
    expect(() => quoteSale([{ ...latte16, qty: 1.5 }], pricing, costing)).toThrow(/whole number/);
    expect(() => quoteSale([{ ...latte16, qty: 0 }], pricing, costing)).toThrow(/whole number/);
    expect(() => quoteSale([{ ...latte16, variantId: 'nope' }], pricing, costing)).toThrow(/Unknown variant/);
    expect(() => quoteSale([{ ...latte16, modifierIds: ['nope'] }], pricing, costing)).toThrow(/Unknown modifier/);
  });
});

describe('settleTenders', () => {
  it('works out change from cash handed over', () => {
    const s = settleTenders(16000, [{ method: 'cash', tendered: 20000 }]);
    expect(s.complete).toBe(true);
    expect(s.change).toBe(4000);
    expect(s.payments).toEqual([{ method: 'cash', amount: 16000, tendered: 20000, change: 4000 }]);
  });

  it('leaves the balance due when cash is short', () => {
    const s = settleTenders(16000, [{ method: 'cash', tendered: 10000 }]);
    expect(s.complete).toBe(false);
    expect(s.remaining).toBe(6000);
    expect(s.change).toBe(0);
  });

  it('splits GCash and cash, with change only from the cash', () => {
    const s = settleTenders(25714, [
      { method: 'gcash', amount: 10000, referenceNo: ' 1234 5678 ' },
      { method: 'cash', tendered: 20000 },
    ]);
    expect(s.complete).toBe(true);
    expect(s.payments).toEqual([
      { method: 'gcash', amount: 10000, referenceNo: '1234 5678' },
      { method: 'cash', amount: 15714, tendered: 20000, change: 4286 },
    ]);
    expect(s.paid).toBe(25714);
  });

  it('requires a reference for electronic tenders', () => {
    const s = settleTenders(16000, [{ method: 'gcash', amount: 16000, referenceNo: '  ' }]);
    expect(s.complete).toBe(false);
    expect(s.problems[0]).toMatch(/reference number/);
  });

  it('refuses an e-wallet overpayment instead of handing back change', () => {
    const s = settleTenders(16000, [{ method: 'qr', amount: 20000, referenceNo: 'R1' }]);
    expect(s.complete).toBe(false);
    expect(s.change).toBe(0);
    expect(s.problems[0]).toMatch(/cannot give change/);
  });

  it('ignores cash offered once electronic payment covers the bill', () => {
    const s = settleTenders(16000, [
      { method: 'gcash', amount: 16000, referenceNo: 'G1' },
      { method: 'cash', tendered: 50000 },
    ]);
    expect(s.complete).toBe(true);
    expect(s.payments.map((p) => p.method)).toEqual(['gcash']);
    expect(s.change).toBe(0);
  });

  it('takes cash as a single tender', () => {
    expect(() =>
      settleTenders(16000, [
        { method: 'cash', tendered: 10000 },
        { method: 'cash', tendered: 10000 },
      ]),
    ).toThrow(/one tender/);
  });
});

describe('summariseShift', () => {
  const sales = [
    { status: 'completed' as const, total: 16000, discountTotal: 0, payments: [{ method: 'cash' as const, amount: 16000 }] },
    {
      status: 'completed' as const,
      total: 25714,
      discountTotal: 4286,
      payments: [
        { method: 'gcash' as const, amount: 10000 },
        { method: 'cash' as const, amount: 15714 },
      ],
    },
    { status: 'voided' as const, total: 9500, discountTotal: 0, payments: [{ method: 'cash' as const, amount: 9500 }] },
  ];

  it('expects the float plus cash taken, excluding voided sales', () => {
    const summary = summariseShift(100000, sales);
    expect(summary.salesCount).toBe(2);
    expect(summary.netSales).toBe(41714);
    expect(summary.discounts).toBe(4286);
    expect(summary.byMethod).toEqual({ cash: 31714, gcash: 10000, qr: 0, card: 0 });
    expect(summary.expectedCash).toBe(131714);
    expect(summary.variance).toBeUndefined();
  });

  it('reports a short drawer as negative variance', () => {
    expect(summariseShift(100000, sales, 131000).variance).toBe(-714);
    expect(summariseShift(100000, sales, 131714).variance).toBe(0);
  });
});

describe('saleDraws', () => {
  const { costing } = seed();

  it('sums recipe and add-on draws per item across the order', () => {
    const { draws, warnings } = saleDraws(
      [
        { variantId: 'iced-latte-16oz', modifierIds: [], qty: 2 },
        { variantId: 'iced-latte-16oz', modifierIds: ['iced-latte-extra-shot'], qty: 1 },
      ],
      costing,
    );
    const qty = (id: string) => draws.find((d) => d.itemId === id)?.qty;

    expect(warnings).toEqual([]);
    expect(qty('espresso')).toBe(36 * 3 + 36);
    expect(qty('fresh-milk')).toBe(180 * 3);
    expect(qty('16-oz-cup')).toBe(3);
    // Espresso is drawn as itself: its beans were consumed when it was pulled.
    expect(qty('benguet-arabica-beans')).toBeUndefined();
  });

  it('draws extra to cover yield loss, as costing does', () => {
    const items: InventoryItem[] = [
      { id: 'milk', companyId: 'c', locationId: 'l', name: 'Milk', category: 'Dairy', itemType: 'raw_material', baseUnit: 'ml', purchaseUnit: 'Pack', packSize: 1000, yieldPct: 0.9, reorderPoint: 0, parLevel: 0, isSeasonal: false },
      { id: 'oat', companyId: 'c', locationId: 'l', name: 'Oat', category: 'Dairy', itemType: 'raw_material', baseUnit: 'ml', purchaseUnit: 'Pack', packSize: 1000, yieldPct: 1, reorderPoint: 0, parLevel: 0, isSeasonal: false },
    ];
    const lines: RecipeLine[] = [
      { id: '1', ownerId: 'latte', ownerType: 'variant', itemId: 'milk', dose: { qty: 180 } },
      // An oat swap removes the dairy and adds oat.
      { id: '2', ownerId: 'oat-swap', ownerType: 'modifier', itemId: 'milk', dose: { qty: -180 } },
      { id: '3', ownerId: 'oat-swap', ownerType: 'modifier', itemId: 'oat', dose: { qty: 180 } },
    ];
    const ctx: CostingContext = {
      getItem: (id) => items.find((i) => i.id === id),
      getItemUnitCost: () => 0,
      getDosingUnits: () => [],
      getRecipeLines: (owner) => lines.filter((l) => l.ownerId === owner),
    };

    expect(saleDraws([{ variantId: 'latte', modifierIds: [], qty: 1 }], ctx).draws).toEqual([
      { itemId: 'milk', qty: 200 },
    ]);
    // The swapped drink draws no dairy at all, so no zero movement is written.
    expect(saleDraws([{ variantId: 'latte', modifierIds: ['oat-swap'], qty: 1 }], ctx).draws).toEqual([
      { itemId: 'oat', qty: 180 },
    ]);
  });
});

describe('seed catalog', () => {
  it('gives every add-on a costed recipe', () => {
    const { catalog } = seed();
    expect(catalog.modifiers.length).toBeGreaterThan(0);
    for (const m of catalog.modifiers) {
      expect(catalog.recipeLines.some((l) => l.ownerId === m.id && l.ownerType === 'modifier')).toBe(true);
      expect(catalog.modifierGroups.some((g) => g.id === m.groupId)).toBe(true);
    }
  });
});
