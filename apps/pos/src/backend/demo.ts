import { buildSeedCatalog, summariseShift, type Centavos } from '@digita/core';
import { readJson, removeKey, writeJson } from '../lib/deviceStorage';
import { toShiftRecord } from '../lib/shift';
import type { Cashier, ClosedShift, PosBackend, RecordedSale, Shift } from './types';

/**
 * Two made-up staff, so the PIN flow can be exercised without the payroll
 * employees table. Real cashiers are payroll employees whose PINs an admin sets
 * through pos_set_cashier_pin().
 */
const DEMO_STAFF: { pin: string; cashier: Cashier }[] = [
  { pin: '1111', cashier: { employeeId: 1, name: 'Demo Barista' } },
  { pin: '2222', cashier: { employeeId: 2, name: 'Demo Supervisor' } },
];

export const DEMO_PINS = DEMO_STAFF.map((s) => s.pin);

/**
 * The open shift and its sales, kept on the device so a reload or restart
 * resumes the shift instead of asking for the opening float again. This is the
 * demo stand-in for the live backend's pos_shifts row with closed_at IS NULL.
 */
const TILL_KEY = 'digita-pos.demo.till.v1';

interface TillState {
  openShift: Shift | null;
  sales: RecordedSale[];
  receiptSeq: number;
}

/**
 * Backend on the shared seed catalog, with till state persisted to the device.
 * Receipt numbers carry a DEMO prefix so a screenshot of one can never pass
 * for a real sale.
 */
export function createDemoBackend(): PosBackend {
  const saved = readJson<TillState>(TILL_KEY);
  let openShift: Shift | null = saved?.openShift ?? null;
  // Sales outlive their shift only in memory; storage keeps the open shift's.
  const sales: RecordedSale[] = openShift ? (saved?.sales ?? []) : [];
  let receiptSeq = saved?.receiptSeq ?? 0;
  let idSeq = 0;

  const save = () => {
    if (openShift === null && receiptSeq === 0) {
      removeKey(TILL_KEY);
      return;
    }
    const shiftId = openShift?.id;
    writeJson(TILL_KEY, {
      openShift,
      sales: shiftId ? sales.filter((s) => s.shiftId === shiftId) : [],
      receiptSeq,
    } satisfies TillState);
  };
  const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++idSeq).toString(36)}`;

  return {
    mode: 'demo',

    async loadShop() {
      return {
        shop: { companyName: 'Zenverse Cafe', locationName: 'Main Store' },
        catalog: buildSeedCatalog(),
      };
    },

    async verifyPin(pin) {
      return DEMO_STAFF.find((s) => s.pin === pin)?.cashier ?? null;
    },

    async findOpenShift() {
      return openShift;
    },

    async openShift(openingFloat: Centavos) {
      if (openShift) throw new Error('A shift is already open on this till.');
      openShift = { id: newId('shift'), openedAt: new Date().toISOString(), openingFloat };
      save();
      return openShift;
    },

    async listShiftSales(shiftId) {
      return sales.filter((s) => s.shiftId === shiftId);
    },

    async closeShift(shiftId, countedCash) {
      if (!openShift || openShift.id !== shiftId) throw new Error('That shift is not open.');
      const summary = summariseShift(
        openShift.openingFloat,
        sales.filter((s) => s.shiftId === shiftId).map(toShiftRecord),
        countedCash,
      );
      const closed: ClosedShift = { ...openShift, closedAt: new Date().toISOString(), summary };
      openShift = null;
      save();
      return closed;
    },

    async recordSale(input) {
      if (!openShift || openShift.id !== input.shiftId) {
        throw new Error('No open shift — open one before ringing up a sale.');
      }
      const sale: RecordedSale = {
        ...input,
        id: newId('sale'),
        receiptNo: `DEMO-${String(++receiptSeq).padStart(5, '0')}`,
        soldAt: new Date().toISOString(),
        status: 'completed',
      };
      sales.push(sale);
      save();
      return sale;
    },
  };
}
