import { useMemo } from 'react';
import { create } from 'zustand';
import { quoteSale, type OrderLine, type SaleQuote, type StatutoryDiscountRequest } from '@digita/core';
import { useCatalog } from './shop';

export interface CartLine extends OrderLine {
  /** Same drink with the same add-ons is one line with a higher qty. */
  key: string;
}

interface CartState {
  lines: CartLine[];
  discount: StatutoryDiscountRequest | null;

  add: (variantId: string, modifierIds: readonly string[], qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  setDiscount: (discount: StatutoryDiscountRequest | null) => void;
  clear: () => void;
}

const lineKey = (variantId: string, modifierIds: readonly string[]) =>
  `${variantId}|${[...modifierIds].sort().join(',')}`;

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  discount: null,

  add: (variantId, modifierIds, qty = 1) =>
    set((state) => {
      const key = lineKey(variantId, modifierIds);
      const existing = state.lines.find((l) => l.key === key);
      if (existing) {
        return {
          lines: state.lines.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l)),
        };
      }
      return { lines: [...state.lines, { key, variantId, modifierIds: [...modifierIds], qty }] };
    }),

  setQty: (key, qty) =>
    set((state) => ({
      lines:
        qty <= 0
          ? state.lines.filter((l) => l.key !== key)
          : state.lines.map((l) => (l.key === key ? { ...l, qty: Math.floor(qty) } : l)),
    })),

  setDiscount: (discount) => set({ discount }),

  clear: () => set({ lines: [], discount: null }),
}));

/**
 * The order priced by the costing engine — the same function the receipt and
 * the persisted sale use, so what the cart shows is what the customer pays.
 */
export function useQuote(): SaleQuote {
  const { pricing, costing } = useCatalog();
  const lines = useCartStore((s) => s.lines);
  const discount = useCartStore((s) => s.discount);
  return useMemo(
    () => quoteSale(lines, pricing, costing, discount ?? undefined),
    [lines, discount, pricing, costing],
  );
}
