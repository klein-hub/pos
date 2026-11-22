import type {
  Centavos,
  SaleQuote,
  SeedCatalog,
  SettledPayment,
  ShiftSummary,
  StockDraw,
} from '@digita/core';

/**
 * Everything the till reads and writes, behind one interface. The demo
 * implementation runs in memory on the seed catalog; the Supabase one replaces
 * it without the screens or stores changing.
 */
export interface PosBackend {
  /** 'demo' keeps everything in memory: nothing survives a reload. */
  readonly mode: 'demo' | 'live';

  loadShop(): Promise<{ shop: Shop; catalog: PosCatalog }>;

  /** The employee behind a PIN, or null. Never exposes the hash. */
  verifyPin(pin: string): Promise<Cashier | null>;

  /** The shift still open on this till, so a restart resumes rather than reopens. */
  findOpenShift(): Promise<Shift | null>;
  openShift(openingFloat: Centavos): Promise<Shift>;
  listShiftSales(shiftId: string): Promise<RecordedSale[]>;
  /**
   * Expected cash is worked out by the backend from what it recorded, not taken
   * from the till — the device being counted is not the one to trust with the sum.
   */
  closeShift(shiftId: string, countedCash: Centavos): Promise<ClosedShift>;

  /**
   * Persist a completed sale with its COGS snapshot, tenders and stock draws.
   * Live, this is one transaction: FEFO allocation of the draws has to happen
   * where the batches can be locked, so two tills never draw the same container.
   */
  recordSale(input: RecordSaleInput): Promise<RecordedSale>;
}

export type PosCatalog = Pick<
  SeedCatalog,
  'items' | 'unitCosts' | 'products' | 'variants' | 'modifierGroups' | 'modifiers' | 'recipeLines'
>;

export interface Shop {
  companyName: string;
  locationName: string;
}

/** A payroll employee, identified at the till by PIN. employees.id is bigint. */
export interface Cashier {
  employeeId: number;
  name: string;
}

export interface Shift {
  id: string;
  openedAt: string;
  openingFloat: Centavos;
}

export interface ClosedShift extends Shift {
  closedAt: string;
  summary: ShiftSummary;
}

export interface RecordSaleInput {
  shiftId: string;
  cashier: Cashier;
  quote: SaleQuote;
  payments: SettledPayment[];
  change: Centavos;
  draws: StockDraw[];
}

export interface RecordedSale extends RecordSaleInput {
  id: string;
  receiptNo: string;
  soldAt: string;
  status: 'completed' | 'voided' | 'refunded';
}
