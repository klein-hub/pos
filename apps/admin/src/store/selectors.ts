import { useMemo } from 'react';
import type { CostingContext } from '@digita/core';
import { buildStockRows, type StockRow } from '../lib/inventory';
import { buildCostingContext, useCatalogStore } from './catalogStore';
import { useInventoryStore } from './inventoryStore';

/**
 * Hooks that read across the catalog and inventory stores. They live apart
 * from both so neither store has to import the other's hooks.
 */

/**
 * The costing engine's view of the app. Built fresh on each render so an
 * edited quantity is reflected immediately — the roll-up is cheap (tens of
 * lines) and correctness here matters more than memoisation.
 */
export function useCostingContext(): CostingContext {
  const { items, unitCosts, recipeLines } = useCatalogStore();
  const batches = useInventoryStore((s) => s.batches);
  return buildCostingContext({ items, unitCosts, recipeLines }, batches);
}

/** One row per inventory item: on hand, cost, cover, expiry and reorder status. */
export function useStockRows(): StockRow[] {
  const { items, unitCosts, recipeLines } = useCatalogStore();
  const batches = useInventoryStore((s) => s.batches);
  const movements = useInventoryStore((s) => s.movements);
  const suppliers = useInventoryStore((s) => s.suppliers);

  return useMemo(
    () =>
      buildStockRows({
        items,
        costing: buildCostingContext({ items, unitCosts, recipeLines }, batches),
        batches,
        movements,
        suppliers,
      }),
    [items, unitCosts, recipeLines, batches, movements, suppliers],
  );
}
