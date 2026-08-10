import { create } from 'zustand';
import type {
  Centavos,
  CostingContext,
  InventoryItem,
  Product,
  ProductVariant,
  RecipeLine,
} from '@digita/core';
import { buildSeedCatalog, seedVolumes } from '../data/seedCatalog';

interface CatalogState {
  items: InventoryItem[];
  unitCosts: Record<string, number>;
  products: Product[];
  variants: ProductVariant[];
  recipeLines: RecipeLine[];
  notes: Record<string, string>;
  volumes: Record<string, number>;
  /** True while running on seed data instead of Supabase. */
  isSeed: boolean;

  setPrice: (variantId: string, price: Centavos) => void;
  setTargetMargin: (variantId: string, targetPct: number) => void;
  setLineQty: (lineId: string, qty: number) => void;
  addLine: (ownerId: string, ownerType: RecipeLine['ownerType'], itemId: string) => void;
  removeLine: (lineId: string) => void;
  reset: () => void;
}

const seed = buildSeedCatalog();

export const useCatalogStore = create<CatalogState>((set) => ({
  ...seed,
  volumes: seedVolumes,
  isSeed: true,

  setPrice: (variantId, price) =>
    set((state) => ({
      variants: state.variants.map((v) =>
        v.id === variantId ? { ...v, sellingPrice: Math.max(0, Math.round(price)) } : v,
      ),
    })),

  setTargetMargin: (variantId, targetPct) =>
    set((state) => ({
      variants: state.variants.map((v) =>
        v.id === variantId ? { ...v, targetMarginPct: clamp(targetPct, 0, 99) } : v,
      ),
    })),

  setLineQty: (lineId, qty) =>
    set((state) => ({
      recipeLines: state.recipeLines.map((l) =>
        l.id === lineId ? { ...l, dose: { ...l.dose, qty } } : l,
      ),
    })),

  addLine: (ownerId, ownerType, itemId) =>
    set((state) => {
      // Adding an item already in the recipe would produce two lines the user
      // has to reconcile by eye; bumping the existing one is what they meant.
      const existing = state.recipeLines.find((l) => l.ownerId === ownerId && l.itemId === itemId);
      if (existing) {
        return {
          recipeLines: state.recipeLines.map((l) =>
            l.id === existing.id ? { ...l, dose: { ...l.dose, qty: l.dose.qty + 1 } } : l,
          ),
        };
      }
      return {
        recipeLines: [
          ...state.recipeLines,
          { id: `${ownerId}:${itemId}:${Date.now()}`, ownerId, ownerType, itemId, dose: { qty: 1 } },
        ],
      };
    }),

  removeLine: (lineId) =>
    set((state) => ({ recipeLines: state.recipeLines.filter((l) => l.id !== lineId) })),

  reset: () => set({ ...buildSeedCatalog(), volumes: seedVolumes }),
}));

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Adapts the store to the shape the costing engine expects. Built fresh on each
 * render so an edited quantity is reflected immediately — the roll-up is cheap
 * (tens of lines) and correctness here matters more than memoisation.
 */
export function useCostingContext(): CostingContext {
  const { items, unitCosts, recipeLines } = useCatalogStore();

  return {
    getItem: (id) => items.find((i) => i.id === id),
    getItemUnitCost: (id) => unitCosts[id],
    getDosingUnits: () => [],
    getRecipeLines: (ownerId) => recipeLines.filter((l) => l.ownerId === ownerId),
  };
}
