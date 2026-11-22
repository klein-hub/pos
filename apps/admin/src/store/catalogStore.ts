import { create } from 'zustand';
import {
  buildSeedCatalog,
  resolveUnitCost,
  type Catalog,
  type Centavos,
  type DataMode,
  type CostingContext,
  type InventoryItem,
  type Product,
  type ProductVariant,
  type RecipeLine,
  type StockBatch,
} from '@digita/core';
import { seedVolumes } from '../data/seedVolumes';

interface CatalogState {
  items: InventoryItem[];
  unitCosts: Record<string, number>;
  products: Product[];
  variants: ProductVariant[];
  recipeLines: RecipeLine[];
  notes: Record<string, string>;
  volumes: Record<string, number>;
  /** Where the loaded catalog came from. Drives the non-live banner. */
  source: DataMode;

  setPrice: (variantId: string, price: Centavos) => void;
  setTargetMargin: (variantId: string, targetPct: number) => void;
  setLineQty: (lineId: string, qty: number) => void;
  addLine: (ownerId: string, ownerType: RecipeLine['ownerType'], itemId: string) => void;
  removeLine: (lineId: string) => void;
  /** Stocking settings only — par, reorder point, supplier, shelf life, yield. */
  updateItem: (itemId: string, patch: ItemSettings) => void;
  /** Swap the whole catalog when the data source changes. */
  replaceCatalog: (catalog: Catalog, source: DataMode) => void;
  reset: () => void;
}

export type ItemSettings = Partial<
  Pick<
    InventoryItem,
    'supplierId' | 'reorderPoint' | 'parLevel' | 'shelfLifeDays' | 'yieldPct' | 'isSeasonal'
  >
>;

const seed = buildSeedCatalog();

export const useCatalogStore = create<CatalogState>((set) => ({
  ...seed,
  volumes: seedVolumes,
  source: 'local',

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

  updateItem: (itemId, patch) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    })),

  replaceCatalog: (catalog, source) =>
    set({
      items: catalog.items,
      unitCosts: catalog.unitCosts,
      products: catalog.products,
      variants: catalog.variants,
      recipeLines: catalog.recipeLines,
      notes: catalog.notes,
      source,
    }),

  reset: () => set({ ...buildSeedCatalog(), volumes: seedVolumes, source: 'local' }),
}));

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Adapts the catalog to the shape the costing engine expects. Item cost comes
 * from received batches once there are any, falling back to the price list —
 * the same order as the pos_item_stock view — so receiving a delivery at a new
 * price moves every margin that uses it.
 */
export function buildCostingContext(
  catalog: Pick<CatalogState, 'items' | 'unitCosts' | 'recipeLines'>,
  batches: readonly StockBatch[],
): CostingContext {
  return {
    getItem: (id) => catalog.items.find((i) => i.id === id),
    getItemUnitCost: (id) =>
      resolveUnitCost(
        batches.filter((b) => b.itemId === id),
        catalog.unitCosts[id],
      ).unitCost,
    getDosingUnits: () => [],
    getRecipeLines: (ownerId) => catalog.recipeLines.filter((l) => l.ownerId === ownerId),
  };
}
