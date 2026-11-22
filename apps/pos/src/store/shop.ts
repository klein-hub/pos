import { create } from 'zustand';
import type {
  CostingContext,
  Modifier,
  ModifierGroup,
  PricingCatalog,
  Product,
  ProductVariant,
  RecipeLine,
} from '@digita/core';
import { backend, type PosCatalog, type Shop } from '../backend';

/**
 * The catalog the till sells from, indexed once. The till never edits it, so
 * unlike the admin's store the costing context can be built a single time
 * instead of on every render.
 */
export interface ShopCatalog {
  shop: Shop;
  products: Product[];
  categories: string[];
  variantsOf(productId: string): ProductVariant[];
  groupsOf(productId: string): ModifierGroup[];
  modifiersIn(groupId: string): Modifier[];
  productOf(variantId: string): Product | undefined;
  pricing: PricingCatalog;
  costing: CostingContext;
}

interface ShopState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  catalog: ShopCatalog | null;
  load: () => Promise<void>;
}

export const useShopStore = create<ShopState>((set, get) => ({
  status: 'idle',
  error: null,
  catalog: null,

  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      const { shop, catalog } = await backend.loadShop();
      set({ status: 'ready', catalog: indexCatalog(shop, catalog) });
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
    }
  },
}));

/** For screens behind the ready guard, where a missing catalog is a bug. */
export function useCatalog(): ShopCatalog {
  const catalog = useShopStore((s) => s.catalog);
  if (!catalog) throw new Error('Catalog not loaded — this screen should be unreachable until it is.');
  return catalog;
}

function indexCatalog(shop: Shop, catalog: PosCatalog): ShopCatalog {
  const sellable = catalog.products.filter((p) => p.isActive);
  const variantsById = new Map(catalog.variants.map((v) => [v.id, v]));
  const modifiersById = new Map(catalog.modifiers.map((m) => [m.id, m]));
  const itemsById = new Map(catalog.items.map((i) => [i.id, i]));
  const productsById = new Map(catalog.products.map((p) => [p.id, p]));

  const variantsByProduct = groupBy(
    catalog.variants.filter((v) => v.isActive),
    (v) => v.productId,
  );
  const groupsByProduct = groupBy(catalog.modifierGroups, (g) => g.productId ?? '');
  const modifiersByGroup = groupBy(
    catalog.modifiers.filter((m) => m.isActive),
    (m) => m.groupId,
  );
  const linesByOwner = groupBy<RecipeLine>(catalog.recipeLines, (l) => l.ownerId);

  return {
    shop,
    // A product with no sellable size cannot be rung up, so it is not shown.
    products: sellable.filter((p) => (variantsByProduct.get(p.id)?.length ?? 0) > 0),
    categories: [...new Set(sellable.map((p) => p.category))],
    variantsOf: (id) => variantsByProduct.get(id) ?? [],
    groupsOf: (id) => groupsByProduct.get(id) ?? [],
    modifiersIn: (id) => modifiersByGroup.get(id) ?? [],
    productOf: (variantId) => {
      const variant = variantsById.get(variantId);
      return variant ? productsById.get(variant.productId) : undefined;
    },
    pricing: {
      getVariant: (id) => variantsById.get(id),
      getModifier: (id) => modifiersById.get(id),
    },
    costing: {
      getItem: (id) => itemsById.get(id),
      getItemUnitCost: (id) => catalog.unitCosts[id],
      getDosingUnits: () => [],
      getRecipeLines: (ownerId) => linesByOwner.get(ownerId) ?? [],
    },
  };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}
