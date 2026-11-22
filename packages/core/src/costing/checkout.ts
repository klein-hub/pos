import type { Modifier, ProductVariant } from '../types/products.js';
import type { AppliedDiscount, Sale, TenderMethod } from '../types/sales.js';
import type { Centavos, Pesos } from '../types/units.js';
import { allocateCentavos, formatPeso, roundUnitCost } from '../utils/money.js';
import { CostingError } from './batches.js';
import { roundQty } from './ledger.js';
import { extractVat, statutoryDiscount, type StatutoryDiscountInput } from './pricing.js';
import { recipeCost, usableYield, variantCost, type CostingContext } from './recipe.js';
import { doseToBaseQty } from './units.js';

/**
 * Checkout maths for the till. Everything here is a pure function of the order
 * and the catalog, so the number on the tablet, the number persisted, and the
 * number the admin dashboard later reads back are the same number.
 */

/** What pricing an order needs beyond what costing already reads. */
export interface PricingCatalog {
  getVariant(variantId: string): ProductVariant | undefined;
  getModifier(modifierId: string): Modifier | undefined;
}

/** One line as the cashier rang it up: a drink, its add-ons, how many. */
export interface OrderLine {
  variantId: string;
  /** A modifier listed twice is applied twice (a double extra shot). */
  modifierIds: readonly string[];
  /** Whole units. */
  qty: number;
}

export interface QuotedLine extends OrderLine {
  /** One unit with its add-ons, VAT-inclusive. */
  unitPrice: Centavos;
  lineGross: Centavos;
  /** This line's share of the sale's output VAT. Lines sum to the header exactly. */
  lineVat: Centavos;
  /** This line's share of the discount. Lines sum to the header exactly. */
  lineDiscount: Centavos;
  /** COGS snapshot for one unit with its add-ons. Persisted, never recomputed. */
  unitCost: Pesos;
  /** Each add-on's own recipe cost, for the sale-line-modifier rows. */
  modifierCosts: Record<string, Pesos>;
}

export type StatutoryDiscountRequest = Omit<StatutoryDiscountInput, 'gross'>;

export interface SaleQuote {
  lines: QuotedLine[];
  /** VAT-inclusive, before any discount. */
  subtotal: Centavos;
  /** VAT-exclusive amount of the sales that VAT is charged on. */
  vatableSales: Centavos;
  /** Output VAT actually charged. */
  vatAmount: Centavos;
  /** VAT-exclusive amount of the senior/PWD share, before their 20%. */
  vatExemptSales: Centavos;
  /** VAT removed on the senior/PWD share. Part of discountTotal. */
  vatExemption: Centavos;
  /** The statutory 20%, taken on the VAT-exclusive exempt amount. Part of discountTotal. */
  exemptDiscount: Centavos;
  /** Everything taken off the subtotal: vatExemption + exemptDiscount. */
  discountTotal: Centavos;
  total: Centavos;
  discount?: AppliedDiscount;
  /** Theoretical COGS of the whole order. */
  costTotal: Pesos;
  /** Costing gaps (unpriced items and the like). For the back office, not the cashier. */
  warnings: string[];
}

/**
 * Price an order. The receipt breakdown satisfies
 *
 *   total = vatableSales + vatAmount + vatExemptSales − exemptDiscount
 *
 * and per-line VAT and discount are allocated so they sum to the header
 * exactly, which is what lets a sale be audited line by line.
 */
export function quoteSale(
  lines: readonly OrderLine[],
  catalog: PricingCatalog,
  costing: CostingContext,
  discount?: StatutoryDiscountRequest,
): SaleQuote {
  const warnings: string[] = [];

  const priced = lines.map((line) => {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new CostingError(`Quantity must be a whole number above zero, got ${line.qty}`);
    }
    const variant = catalog.getVariant(line.variantId);
    if (!variant) throw new CostingError(`Unknown variant "${line.variantId}"`);

    let unitPrice = variant.sellingPrice;
    for (const id of line.modifierIds) {
      const modifier = catalog.getModifier(id);
      if (!modifier) throw new CostingError(`Unknown modifier "${id}"`);
      unitPrice += modifier.priceDelta;
    }
    if (unitPrice < 0) {
      throw new CostingError(`"${line.variantId}" with its add-ons is priced below zero`);
    }

    const cost = variantCost(line.variantId, line.modifierIds, costing);
    warnings.push(...cost.warnings);

    return {
      variantId: line.variantId,
      modifierIds: [...line.modifierIds],
      qty: line.qty,
      unitPrice,
      lineGross: unitPrice * line.qty,
      unitCost: cost.total,
      modifierCosts: Object.fromEntries(
        line.modifierIds.map((id) => [id, recipeCost(id, costing).total]),
      ),
    };
  });

  const subtotal = priced.reduce((sum, l) => sum + l.lineGross, 0);

  let vatableSales: Centavos;
  let vatAmount: Centavos;
  let vatExemptSales = 0;
  let vatExemption = 0;
  let exemptDiscount = 0;
  let applied: AppliedDiscount | undefined;

  if (discount) {
    const statutory = statutoryDiscount({ ...discount, gross: subtotal });
    // Only the cardholder's share is exempt; the rest of a group's bill is
    // still ordinary VATable sales.
    const vatable = extractVat(subtotal - statutory.qualifyingGross);
    vatableSales = vatable.net;
    vatAmount = vatable.vat;
    vatExemptSales = statutory.qualifyingGross - statutory.vatExempt;
    vatExemption = statutory.vatExempt;
    exemptDiscount = statutory.discount;
    applied = statutory.applied;
  } else {
    const vatable = extractVat(subtotal);
    vatableSales = vatable.net;
    vatAmount = vatable.vat;
  }

  const discountTotal = vatExemption + exemptDiscount;
  const weights = priced.map((l) => l.lineGross);
  const lineVat = allocateCentavos(vatAmount, weights);
  const lineDiscount = allocateCentavos(discountTotal, weights);

  return {
    lines: priced.map((l, i) => ({ ...l, lineVat: lineVat[i] ?? 0, lineDiscount: lineDiscount[i] ?? 0 })),
    subtotal,
    vatableSales,
    vatAmount,
    vatExemptSales,
    vatExemption,
    exemptDiscount,
    discountTotal,
    total: subtotal - discountTotal,
    ...(applied ? { discount: applied } : {}),
    costTotal: roundUnitCost(priced.reduce((sum, l) => sum + l.unitCost * l.qty, 0)),
    warnings: [...new Set(warnings)],
  };
}

// --- Tenders -----------------------------------------------------------------

export const TENDER_LABELS: Record<TenderMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  qr: 'QR',
  card: 'Card',
};

/**
 * Cash is entered as what the customer handed over; the change falls out.
 * Electronic tenders are entered as the exact amount sent, with the reference
 * from the customer's confirmation screen.
 */
export type TenderInput =
  | { method: 'cash'; tendered: Centavos }
  | { method: Exclude<TenderMethod, 'cash'>; amount: Centavos; referenceNo: string };

export interface SettledPayment {
  method: TenderMethod;
  /** Applied to the sale, net of change. Never more than was due. */
  amount: Centavos;
  referenceNo?: string;
  tendered?: Centavos;
  change?: Centavos;
}

export interface Settlement {
  payments: SettledPayment[];
  paid: Centavos;
  remaining: Centavos;
  change: Centavos;
  /** Input the cashier has to fix before the sale can complete. */
  problems: string[];
  complete: boolean;
}

/**
 * Apply tenders to a total, electronic first and cash last, so that change can
 * only ever come out of cash. An e-wallet transfer larger than the bill is a
 * problem to fix, not change to hand back — the drawer never received it.
 */
export function settleTenders(total: Centavos, tenders: readonly TenderInput[]): Settlement {
  assertCentavos(total, 'Total');
  const cashTenders = tenders.filter((t) => t.method === 'cash');
  if (cashTenders.length > 1) {
    throw new CostingError('Record cash as one tender — change is worked out from the total handed over');
  }

  const problems: string[] = [];
  const payments: SettledPayment[] = [];
  let electronic = 0;

  for (const tender of tenders) {
    if (tender.method === 'cash') continue;
    assertCentavos(tender.amount, TENDER_LABELS[tender.method]);
    const label = TENDER_LABELS[tender.method];
    if (tender.amount <= 0) {
      problems.push(`${label} amount must be more than zero.`);
      continue;
    }
    const referenceNo = tender.referenceNo.trim();
    if (!referenceNo) {
      problems.push(`Enter the ${label} reference number from the customer's confirmation.`);
    }
    electronic += tender.amount;
    payments.push({ method: tender.method, amount: tender.amount, ...(referenceNo ? { referenceNo } : {}) });
  }

  if (electronic > total) {
    problems.push(
      `Electronic payments are ${formatPeso(electronic - total)} over the total — they cannot give change.`,
    );
  }

  let cashApplied = 0;
  let change = 0;
  const cash = cashTenders[0];
  if (cash) {
    assertCentavos(cash.tendered, 'Cash tendered');
    cashApplied = Math.min(cash.tendered, Math.max(0, total - electronic));
    // Cash offered when nothing is left to pay in cash was never taken.
    if (cashApplied > 0) {
      change = cash.tendered - cashApplied;
      payments.push({ method: 'cash', amount: cashApplied, tendered: cash.tendered, change });
    }
  }

  const paid = electronic + cashApplied;
  const remaining = Math.max(0, total - paid);

  return {
    payments,
    paid,
    remaining,
    change,
    problems,
    complete: problems.length === 0 && remaining === 0,
  };
}

function assertCentavos(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new CostingError(`${label} must be a whole, non-negative number of centavos, got ${value}`);
  }
}

// --- Shift close -------------------------------------------------------------

export interface ShiftSaleRecord {
  status: Sale['status'];
  total: Centavos;
  discountTotal: Centavos;
  payments: readonly Pick<SettledPayment, 'method' | 'amount'>[];
}

export interface ShiftSummary {
  salesCount: number;
  /** What completed sales took in, after discounts. */
  netSales: Centavos;
  discounts: Centavos;
  byMethod: Record<TenderMethod, Centavos>;
  /** Opening float plus cash taken (net of change). */
  expectedCash: Centavos;
  countedCash?: Centavos;
  /** Counted minus expected. Negative means the drawer is short. */
  variance?: Centavos;
}

/**
 * Only completed sales count toward the drawer. A voided sale's cash went back
 * to the customer at the counter, so counting it would read as a shortage.
 */
export function summariseShift(
  openingFloat: Centavos,
  sales: readonly ShiftSaleRecord[],
  countedCash?: Centavos,
): ShiftSummary {
  const byMethod: Record<TenderMethod, Centavos> = { cash: 0, gcash: 0, qr: 0, card: 0 };
  let salesCount = 0;
  let netSales = 0;
  let discounts = 0;

  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    salesCount++;
    netSales += sale.total;
    discounts += sale.discountTotal;
    for (const p of sale.payments) byMethod[p.method] += p.amount;
  }

  const expectedCash = openingFloat + byMethod.cash;
  return {
    salesCount,
    netSales,
    discounts,
    byMethod,
    expectedCash,
    ...(countedCash !== undefined
      ? { countedCash, variance: countedCash - expectedCash }
      : {}),
  };
}

// --- Stock deduction ---------------------------------------------------------

export interface StockDraw {
  itemId: string;
  /** Base units taken from stock. Negative returns stock (an add-on that swaps an ingredient out). */
  qty: number;
}

export interface DrawPlan {
  draws: StockDraw[];
  warnings: string[];
}

/**
 * Base units an order takes out of stock: each line's recipe plus every
 * add-on's, yield loss included, summed per item across the order.
 *
 * Sub-assemblies are drawn as themselves, not exploded to their ingredients —
 * a prep batch of espresso or a baked cheesecake already consumed its
 * ingredients when it was produced, and carries its own cost.
 *
 * This is the input to FEFO allocation, which has to run where the batches can
 * be locked, so two tills can never draw the same container.
 */
export function saleDraws(lines: readonly OrderLine[], ctx: CostingContext): DrawPlan {
  const warnings: string[] = [];
  const totals = new Map<string, number>();

  for (const line of lines) {
    for (const ownerId of [line.variantId, ...line.modifierIds]) {
      for (const recipeLine of ctx.getRecipeLines(ownerId)) {
        const item = ctx.getItem(recipeLine.itemId);
        if (!item) {
          warnings.push(`Recipe references a missing item (${recipeLine.itemId}) — it was not deducted.`);
          continue;
        }
        let baseQty: number;
        try {
          baseQty = doseToBaseQty(recipeLine.dose, ctx.getDosingUnits(item.id));
        } catch (err) {
          warnings.push(`${item.name}: ${(err as Error).message}`);
          continue;
        }
        const drawn = (baseQty / usableYield(item.yieldPct)) * line.qty;
        totals.set(item.id, (totals.get(item.id) ?? 0) + drawn);
      }
    }
  }

  const draws = [...totals]
    .map(([itemId, qty]) => ({ itemId, qty: roundQty(qty) }))
    // The ledger refuses a zero movement, and a swap that nets out moved nothing.
    .filter((d) => d.qty !== 0);

  return { draws, warnings: [...new Set(warnings)] };
}
