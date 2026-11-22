import { create } from 'zustand';
import type { Centavos } from '@digita/core';
import {
  backend,
  type Cashier,
  type ClosedShift,
  type RecordSaleInput,
  type RecordedSale,
  type Shift,
} from '../backend';

/**
 * Who is at the till and which shift they are ringing into. The shift belongs
 * to the till, not the cashier: locking hands the till to the next person
 * without closing the drawer, and each sale records whoever rang it up.
 */
interface SessionState {
  cashier: Cashier | null;
  shift: Shift | null;
  /** This shift's sales, newest first. */
  sales: RecordedSale[];
  /** The shift just closed, shown on the PIN screen until the next unlock. */
  lastClose: ClosedShift | null;

  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  openShift: (openingFloat: Centavos) => Promise<void>;
  recordSale: (input: Omit<RecordSaleInput, 'shiftId' | 'cashier'>) => Promise<RecordedSale>;
  closeShift: (countedCash: Centavos) => Promise<void>;
  dismissLastClose: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  cashier: null,
  shift: null,
  sales: [],
  lastClose: null,

  unlock: async (pin) => {
    const cashier = await backend.verifyPin(pin);
    if (!cashier) return false;

    // Resolve the shift before setting the cashier, so the route guards flip
    // once — straight to the register — instead of flashing the open-shift screen.
    let { shift, sales } = get();
    if (!shift) {
      shift = await backend.findOpenShift();
      sales = shift ? newestFirst(await backend.listShiftSales(shift.id)) : [];
    }
    set({ cashier, shift, sales, lastClose: null });
    return true;
  },

  lock: () => set({ cashier: null }),

  openShift: async (openingFloat) => {
    const shift = await backend.openShift(openingFloat);
    set({ shift, sales: [] });
  },

  recordSale: async (input) => {
    const { cashier, shift } = get();
    if (!cashier || !shift) throw new Error('No cashier or shift — unlock the till first.');
    const sale = await backend.recordSale({ ...input, shiftId: shift.id, cashier });
    set((state) => ({ sales: [sale, ...state.sales] }));
    return sale;
  },

  // Clears the till in the same update that records the close, so no screen
  // (or Android back gesture) can reach a register whose shift is gone.
  closeShift: async (countedCash) => {
    const { shift } = get();
    if (!shift) throw new Error('No shift is open.');
    const closed = await backend.closeShift(shift.id, countedCash);
    set({ cashier: null, shift: null, sales: [], lastClose: closed });
  },

  dismissLastClose: () => set({ lastClose: null }),
}));

function newestFirst(sales: RecordedSale[]): RecordedSale[] {
  return [...sales].sort((a, b) => b.soldAt.localeCompare(a.soldAt));
}
