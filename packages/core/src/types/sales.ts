import type { Centavos, Pesos } from './units.js';

export type TenderMethod = 'cash' | 'gcash' | 'qr' | 'card';

export type DiscountKind = 'senior' | 'pwd' | 'promo' | 'comp' | 'staff';

export interface AppliedDiscount {
  kind: DiscountKind;
  /** Senior/PWD require the ID for the BIR-mandated discount register. */
  idNumber?: string;
  holderName?: string;
  amount: Centavos;
}

export interface SaleLine {
  id: string;
  saleId: string;
  variantId: string;
  qty: number;
  unitPrice: Centavos;
  /**
   * Cost of one unit at the moment of sale. Snapshotted so historical margin
   * survives later supplier price changes — never recomputed from live cost.
   */
  unitCostSnapshot: Pesos;
  modifierIds: string[];
  lineVat: Centavos;
}

export interface SalePayment {
  id: string;
  saleId: string;
  method: TenderMethod;
  amount: Centavos;
  referenceNo?: string;
  tendered?: Centavos;
  change?: Centavos;
}

export interface Sale {
  id: string;
  companyId: string;
  locationId: string;
  receiptNo: string;
  cashierEmployeeId: string;
  subtotal: Centavos;
  vatAmount: Centavos;
  discountTotal: Centavos;
  total: Centavos;
  status: 'completed' | 'voided' | 'refunded';
  soldAt: string;
}

export interface Shift {
  id: string;
  locationId: string;
  openedBy: string;
  openedAt: string;
  openingFloat: Centavos;
  closedAt?: string;
  countedCash?: Centavos;
  expectedCash?: Centavos;
  variance?: Centavos;
}
