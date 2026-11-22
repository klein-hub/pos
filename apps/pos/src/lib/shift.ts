import type { ShiftSaleRecord } from '@digita/core';
import type { RecordedSale } from '../backend/types';

/** The slice of a recorded sale that the drawer reconciliation reads. */
export function toShiftRecord(sale: RecordedSale): ShiftSaleRecord {
  return {
    status: sale.status,
    total: sale.quote.total,
    discountTotal: sale.quote.discountTotal,
    payments: sale.payments,
  };
}
