import type { AppliedDiscount, DiscountKind } from '../types/sales.js';
import type { Centavos, Pesos } from '../types/units.js';
import { toCentavos, toPesos } from '../utils/money.js';
import { CostingError } from './batches.js';

/** Philippine VAT. Kept configurable so a rate change is a constant, not a rewrite. */
export const VAT_RATE = 0.12;

/** Senior citizen / PWD statutory discount (RA 9994, RA 10754). */
export const STATUTORY_DISCOUNT_RATE = 0.2;

export interface VatSplit {
  /** VAT-exclusive amount. */
  net: Centavos;
  vat: Centavos;
  gross: Centavos;
}

/**
 * Menu prices are quoted VAT-inclusive, so VAT is always *extracted* from the
 * price rather than added to it. Net is rounded and VAT is taken as the
 * remainder, which keeps net + vat === gross exactly — no stray centavo.
 */
export function extractVat(gross: Centavos, rate: number = VAT_RATE): VatSplit {
  if (!Number.isInteger(gross)) {
    throw new CostingError(`VAT must be extracted from an integer centavo amount, got ${gross}`);
  }
  if (rate < 0) throw new CostingError(`VAT rate must not be negative, got ${rate}`);

  const net = Math.round(gross / (1 + rate));
  return { net, vat: gross - net, gross };
}

export interface MarginResult {
  /** VAT-exclusive selling price. */
  netPrice: Pesos;
  cost: Pesos;
  grossProfit: Pesos;
  /** Profit as a share of net price. The number to judge a menu item on. */
  marginPct: number;
  /** Profit as a multiple of cost. The number people quote as "3x markup". */
  markupPct: number;
  /** True when a target is set and the item is under it. */
  belowTarget: boolean;
}

/**
 * Margin is always computed against the VAT-exclusive price — VAT is the
 * government's money, not revenue, and including it inflates every margin
 * by roughly 10 points.
 */
export function margin(
  sellingPriceGross: Centavos,
  cost: Pesos,
  targetMarginPct?: number,
): MarginResult {
  const { net } = extractVat(sellingPriceGross);
  const netPrice = toPesos(net);
  const grossProfit = netPrice - cost;
  const marginPct = netPrice > 0 ? (grossProfit / netPrice) * 100 : 0;
  const markupPct = cost > 0 ? (grossProfit / cost) * 100 : 0;

  return {
    netPrice,
    cost,
    grossProfit,
    marginPct,
    markupPct,
    belowTarget: targetMarginPct !== undefined && marginPct < targetMarginPct,
  };
}

/** Price that would hit a target margin. A suggestion, never auto-applied. */
export function suggestedPrice(cost: Pesos, targetMarginPct: number): Centavos {
  if (targetMarginPct >= 100) {
    throw new CostingError('A target margin of 100% or more is unreachable at any finite price');
  }
  const net = cost / (1 - targetMarginPct / 100);
  return toCentavos(net * (1 + VAT_RATE));
}

/** Round a suggested price up to the nearest ₱5 — menu boards want round numbers. */
export function roundToMenuPrice(price: Centavos, stepCentavos = 500): Centavos {
  return Math.ceil(price / stepCentavos) * stepCentavos;
}

export interface StatutoryDiscountInput {
  /** VAT-inclusive total of the qualifying items. */
  gross: Centavos;
  kind: Extract<DiscountKind, 'senior' | 'pwd'>;
  idNumber: string;
  holderName: string;
  /**
   * Group dining: the statutory discount covers only the cardholder's share.
   * Defaults to a solo transaction.
   */
  totalPax?: number;
  qualifiedPax?: number;
}

export interface StatutoryDiscountResult {
  /** VAT removed because the sale is exempt for this customer. */
  vatExempt: Centavos;
  /** 20% of the VAT-exclusive base. */
  discount: Centavos;
  /** What the customer pays. */
  payable: Centavos;
  applied: AppliedDiscount;
}

/**
 * Senior citizen / PWD sale. The statutory order matters and is a common source
 * of BIR findings: strip the 12% VAT first, then take 20% off the VAT-exempt
 * amount. Discounting the gross instead over-refunds the customer and
 * understates output VAT.
 */
export function statutoryDiscount(input: StatutoryDiscountInput): StatutoryDiscountResult {
  const { gross, kind, idNumber, holderName } = input;
  const totalPax = input.totalPax ?? 1;
  const qualifiedPax = input.qualifiedPax ?? 1;

  if (!idNumber?.trim()) {
    throw new CostingError(`A ${kind} discount requires an ID number for the discount register`);
  }
  if (!(totalPax > 0) || !(qualifiedPax > 0) || qualifiedPax > totalPax) {
    throw new CostingError(`Invalid pax split: ${qualifiedPax} qualified of ${totalPax}`);
  }

  const share = qualifiedPax / totalPax;
  const qualifyingGross = Math.round(gross * share);
  const { net, vat } = extractVat(qualifyingGross);
  const discount = Math.round(net * STATUTORY_DISCOUNT_RATE);
  const payable = gross - vat - discount;

  return {
    vatExempt: vat,
    discount,
    payable,
    applied: {
      kind,
      idNumber: idNumber.trim(),
      holderName: holderName.trim(),
      amount: vat + discount,
    },
  };
}
