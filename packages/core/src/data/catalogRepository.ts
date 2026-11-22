import type { SupabaseClient } from '@supabase/supabase-js';
import type { InventoryItem } from '../types/inventory.js';
import type { Modifier, ModifierGroup, Product, ProductVariant, RecipeLine } from '../types/products.js';
import type { SeedCatalog } from '../seed/catalog.js';

/**
 * Where a catalog comes from.
 *
 * The apps can run against the in-memory seed or against Supabase, and the
 * rest of the code should not care which. Both sides produce the same
 * SeedCatalog shape, which is what makes the two interchangeable — and what
 * scripts/check-catalog-parity.sh exists to keep true.
 */
export interface CatalogRepository {
  loadCatalog(): Promise<SeedCatalog>;
}

/** Row shapes as they come back from the pos_ tables. */
interface ItemRow {
  id: string;
  company_id: string;
  location_id: string | null;
  name: string;
  category: string;
  item_type: InventoryItem['itemType'];
  base_unit: InventoryItem['baseUnit'];
  purchase_unit: string;
  pack_size: number | string;
  density_g_per_ml: number | string | null;
  yield_pct: number | string;
  reorder_point: number | string;
  par_level: number | string;
  is_seasonal: boolean;
  supplier_id: string | null;
  shelf_life_days: number | null;
  days_after_opening: number | null;
  prep_yield_qty: number | string | null;
  standard_unit_cost: number | string | null;
}

interface ProductRow {
  id: string;
  company_id: string;
  name: string;
  category: string;
  product_type: Product['productType'];
  image_url: string | null;
  is_active: boolean;
}

interface VariantRow {
  id: string;
  product_id: string;
  size: string;
  selling_price: number;
  sku: string | null;
  target_margin_pct: number | string | null;
  is_active: boolean;
}

interface GroupRow {
  id: string;
  product_id: string | null;
  name: string;
  min_select: number;
  max_select: number;
}

interface ModifierRow {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_active: boolean;
}

interface RecipeLineRow {
  id: string;
  owner_id: string;
  owner_type: RecipeLine['ownerType'];
  item_id: string;
  qty: number | string;
  dosing_unit_id: string | null;
}

/**
 * Postgres returns numeric as a string, because a numeric can hold values no
 * JavaScript number can. Our quantities and costs are comfortably in range, so
 * converting is safe — but it has to be deliberate. Left implicit, `pack_size`
 * arrives as "1000.0000" and every arithmetic operation on it silently becomes
 * string concatenation.
 */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`Expected a number from the database, got ${String(v)}`);
  return n;
}

function optionalNum(v: number | string | null | undefined): number | undefined {
  return v === null || v === undefined ? undefined : num(v);
}

export interface SupabaseCatalogOptions {
  client: SupabaseClient;
  companyId: string;
}

/**
 * Reads the catalog out of the pos_ tables for one company.
 *
 * Every query is scoped by company_id. RLS enforces that too, but filtering
 * here as well means a mis-scoped read fails loudly as an empty catalog rather
 * than quietly returning another tenant's rows to someone entitled to them —
 * a super admin reading the demo company must not accidentally pull live rows
 * into the same screen.
 */
export function createSupabaseCatalogRepository({
  client,
  companyId,
}: SupabaseCatalogOptions): CatalogRepository {
  return {
    async loadCatalog(): Promise<SeedCatalog> {
      const [items, products, variants, groups, modifiers, lines] = await Promise.all([
        select<ItemRow>(client, 'pos_items', companyId),
        select<ProductRow>(client, 'pos_products', companyId),
        select<VariantRow>(client, 'pos_product_variants', companyId),
        select<GroupRow>(client, 'pos_modifier_groups', companyId),
        select<ModifierRow>(client, 'pos_modifiers', companyId),
        select<RecipeLineRow>(client, 'pos_recipe_lines', companyId),
      ]);

      const unitCosts: Record<string, number> = {};
      const notes: Record<string, string> = {};

      const mappedItems: InventoryItem[] = items.map((r) => {
        const cost = optionalNum(r.standard_unit_cost);
        if (cost !== undefined) unitCosts[r.id] = cost;
        return {
          id: r.id,
          companyId: r.company_id,
          locationId: r.location_id ?? '',
          name: r.name,
          category: r.category,
          itemType: r.item_type,
          baseUnit: r.base_unit,
          purchaseUnit: r.purchase_unit,
          packSize: num(r.pack_size),
          densityGPerMl: optionalNum(r.density_g_per_ml),
          yieldPct: num(r.yield_pct),
          reorderPoint: num(r.reorder_point),
          parLevel: num(r.par_level),
          isSeasonal: r.is_seasonal,
          supplierId: r.supplier_id ?? undefined,
          shelfLifeDays: r.shelf_life_days ?? undefined,
          daysAfterOpening: r.days_after_opening ?? undefined,
          prepYieldQty: optionalNum(r.prep_yield_qty),
        };
      });

      return {
        items: mappedItems,
        unitCosts,
        notes,
        products: products.map(
          (r): Product => ({
            id: r.id,
            companyId: r.company_id,
            name: r.name,
            category: r.category,
            productType: r.product_type,
            imageUrl: r.image_url ?? undefined,
            isActive: r.is_active,
          }),
        ),
        variants: variants.map(
          (r): ProductVariant => ({
            id: r.id,
            productId: r.product_id,
            size: r.size,
            sellingPrice: r.selling_price,
            sku: r.sku ?? undefined,
            targetMarginPct: optionalNum(r.target_margin_pct),
            isActive: r.is_active,
          }),
        ),
        modifierGroups: groups.map(
          (r): ModifierGroup => ({
            id: r.id,
            productId: r.product_id ?? undefined,
            name: r.name,
            minSelect: r.min_select,
            maxSelect: r.max_select,
          }),
        ),
        modifiers: modifiers.map(
          (r): Modifier => ({
            id: r.id,
            groupId: r.group_id,
            name: r.name,
            priceDelta: r.price_delta,
            isActive: r.is_active,
          }),
        ),
        recipeLines: lines.map(
          (r): RecipeLine => ({
            id: r.id,
            ownerId: r.owner_id,
            ownerType: r.owner_type,
            itemId: r.item_id,
            dose: {
              qty: num(r.qty),
              ...(r.dosing_unit_id ? { dosingUnitId: r.dosing_unit_id } : {}),
            },
          }),
        ),
      };
    },
  };
}

async function select<T>(client: SupabaseClient, table: string, companyId: string): Promise<T[]> {
  const { data, error } = await client.from(table).select('*').eq('company_id', companyId);
  if (error) {
    throw new Error(`Could not read ${table}: ${error.message}`);
  }
  return (data ?? []) as T[];
}

/** The in-memory catalog, for running with no database at all. */
export function createLocalCatalogRepository(build: () => SeedCatalog): CatalogRepository {
  return { loadCatalog: async () => build() };
}
