import { describe, expect, it } from '@jest/globals';
import {
  classifyMenu,
  extractVat,
  formatPeso,
  margin,
  roundToMenuPrice,
  statutoryDiscount,
  suggestedPrice,
  toCentavos,
} from '../src/index.js';

describe('VAT', () => {
  it('extracts VAT from a menu price rather than adding it on top', () => {
    const { net, vat, gross } = extractVat(16000); // ₱160.00
    expect(net).toBe(14286);
    expect(vat).toBe(1714);
    expect(net + vat).toBe(gross);
  });

  it('never loses a centavo to rounding, at any price', () => {
    for (let gross = 1; gross <= 5000; gross++) {
      const { net, vat } = extractVat(gross);
      expect(net + vat).toBe(gross);
    }
  });

  it('rejects fractional centavos', () => {
    expect(() => extractVat(160.5)).toThrow();
  });
});

describe('margin', () => {
  it('measures margin against the VAT-exclusive price', () => {
    const result = margin(16000, 33.66);
    expect(result.netPrice).toBeCloseTo(142.86, 2);
    expect(result.grossProfit).toBeCloseTo(109.2, 2);
    expect(result.marginPct).toBeCloseTo(76.44, 2);
  });

  it('would overstate margin if VAT were counted as revenue', () => {
    const correct = margin(16000, 33.66);
    const naive = ((160 - 33.66) / 160) * 100;
    expect(naive - correct.marginPct).toBeGreaterThan(2);
  });

  it('flags an item that has fallen below its target', () => {
    expect(margin(16000, 33.66, 70).belowTarget).toBe(false);
    // A bean price rise pushes cost up and the item under target.
    expect(margin(16000, 50, 70).belowTarget).toBe(true);
  });

  it('reports markup separately from margin', () => {
    const result = margin(16000, 33.66);
    expect(result.markupPct).toBeCloseTo(324.42, 2);
    expect(result.markupPct).toBeGreaterThan(result.marginPct);
  });
});

describe('price suggestion', () => {
  it('suggests a price that hits the target margin', () => {
    const price = suggestedPrice(33.66, 75);
    expect(margin(price, 33.66).marginPct).toBeCloseTo(75, 1);
  });

  it('rounds up to a menu-board price', () => {
    expect(roundToMenuPrice(toCentavos(150.82))).toBe(15500);
    expect(roundToMenuPrice(15000)).toBe(15000);
  });

  it('refuses an unreachable target', () => {
    expect(() => suggestedPrice(33.66, 100)).toThrow();
  });
});

describe('senior citizen / PWD discount', () => {
  it('strips VAT first, then takes 20% of the VAT-exempt amount', () => {
    const result = statutoryDiscount({
      gross: 16000,
      kind: 'senior',
      idNumber: 'SC-12345',
      holderName: 'Test Holder',
    });
    expect(result.vatExempt).toBe(1714);
    expect(result.discount).toBe(2857);
    expect(result.payable).toBe(11429);
  });

  it('gives less away than discounting the gross would', () => {
    const correct = statutoryDiscount({
      gross: 16000,
      kind: 'senior',
      idNumber: 'SC-1',
      holderName: 'A',
    });
    const naive = 16000 - Math.round(16000 * 0.2);
    // Discounting the gross both over-refunds and understates output VAT.
    expect(correct.payable).toBeLessThan(naive);
  });

  it('covers only the cardholder share when dining in a group', () => {
    const solo = statutoryDiscount({ gross: 32000, kind: 'pwd', idNumber: 'P-1', holderName: 'A' });
    const shared = statutoryDiscount({
      gross: 32000,
      kind: 'pwd',
      idNumber: 'P-1',
      holderName: 'A',
      totalPax: 2,
      qualifiedPax: 1,
    });
    expect(shared.discount).toBeLessThan(solo.discount);
    expect(shared.payable).toBeGreaterThan(solo.payable);
  });

  it('requires an ID for the discount register', () => {
    expect(() =>
      statutoryDiscount({ gross: 16000, kind: 'senior', idNumber: '  ', holderName: 'A' }),
    ).toThrow(/ID number/i);
  });
});

describe('menu engineering', () => {
  const menu = classifyMenu([
    { variantId: 'v1', name: 'Iced Latte 16oz', unitsSold: 400, unitProfit: 109 },
    { variantId: 'v2', name: 'Iced Coffee 16oz', unitsSold: 380, unitProfit: 55 },
    { variantId: 'v3', name: 'Matcha Latte 16oz', unitsSold: 40, unitProfit: 120 },
    { variantId: 'v4', name: 'Lychee Iced Tea', unitsSold: 12, unitProfit: 40 },
  ]);

  const find = (id: string) => menu.find((m) => m.variantId === id);

  it('places popular, profitable drinks as stars', () => {
    expect(find('v1')?.quadrant).toBe('star');
  });

  it('places high-volume, low-profit drinks as plowhorses', () => {
    expect(find('v2')?.quadrant).toBe('plowhorse');
  });

  it('places profitable but overlooked drinks as puzzles', () => {
    expect(find('v3')?.quadrant).toBe('puzzle');
  });

  it('places the slow, thin drinks as dogs', () => {
    // The lychee syrup sitting at zero stock, SLOW, in the old sheet.
    expect(find('v4')?.quadrant).toBe('dog');
    expect(find('v4')?.advice).toMatch(/candidate to cut/i);
  });

  it('handles an empty menu', () => {
    expect(classifyMenu([])).toEqual([]);
  });
});

describe('formatting', () => {
  it('formats pesos with thousands separators', () => {
    expect(formatPeso(1234567)).toBe('₱12,345.67');
    expect(formatPeso(-500)).toBe('-₱5.00');
    expect(formatPeso(5)).toBe('₱0.05');
  });
});
