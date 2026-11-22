import { describe, expect, it } from '@jest/globals';
import { createSupabaseCatalogRepository } from '../src/index.js';

/**
 * A stand-in for the Supabase client: records which tables were asked for and
 * with what company filter, and returns canned rows.
 */
function fakeClient(rows: Record<string, unknown[]>, calls: { table: string; companyId: string }[] = []) {
  return {
    calls,
    from(table: string) {
      return {
        select() {
          return {
            eq(_col: string, companyId: string) {
              calls.push({ table, companyId });
              return Promise.resolve({ data: rows[table] ?? [], error: null });
            },
          };
        },
      };
    },
  } as never;
}

const itemRow = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  company_id: 'c1',
  location_id: 'l1',
  name: 'Fresh Milk',
  category: 'Dairy',
  item_type: 'raw_material',
  base_unit: 'ml',
  purchase_unit: 'Pack',
  pack_size: 1000,
  density_g_per_ml: null,
  yield_pct: 1,
  reorder_point: 0,
  par_level: 0,
  is_seasonal: false,
  supplier_id: null,
  shelf_life_days: null,
  days_after_opening: null,
  prep_yield_qty: null,
  standard_unit_cost: 0.072,
  ...over,
});

describe('supabase catalog repository', () => {
  it('maps an item into the shape the costing engine expects', async () => {
    const repo = createSupabaseCatalogRepository({
      client: fakeClient({ pos_items: [itemRow()] }),
      companyId: 'c1',
    });
    const catalog = await repo.loadCatalog();

    expect(catalog.items[0]).toMatchObject({
      id: 'i1',
      name: 'Fresh Milk',
      baseUnit: 'ml',
      packSize: 1000,
      yieldPct: 1,
      itemType: 'raw_material',
    });
    // The price list lands where the engine looks for it.
    expect(catalog.unitCosts['i1']).toBeCloseTo(0.072, 6);
  });

  it('accepts numerics as strings too, since a direct pg connection returns those', async () => {
    const repo = createSupabaseCatalogRepository({
      client: fakeClient({
        pos_items: [itemRow({ pack_size: '2500.0000', standard_unit_cost: '0.102000', yield_pct: '0.9700' })],
      }),
      companyId: 'c1',
    });
    const catalog = await repo.loadCatalog();

    expect(catalog.items[0]?.packSize).toBe(2500);
    expect(catalog.items[0]?.yieldPct).toBeCloseTo(0.97, 6);
    expect(catalog.unitCosts['i1']).toBeCloseTo(0.102, 6);
    // Not "2500.0000" — a string here would turn every later `+` into concatenation.
    expect(typeof catalog.items[0]?.packSize).toBe('number');
  });

  it('leaves an unpriced item out of unitCosts rather than costing it at zero', async () => {
    const repo = createSupabaseCatalogRepository({
      client: fakeClient({ pos_items: [itemRow({ standard_unit_cost: null })] }),
      companyId: 'c1',
    });
    const catalog = await repo.loadCatalog();

    // The engine warns on a missing cost; a 0 would silently read as free.
    expect(catalog.unitCosts['i1']).toBeUndefined();
  });

  it('scopes every table to the company', async () => {
    const calls: { table: string; companyId: string }[] = [];
    const repo = createSupabaseCatalogRepository({
      client: fakeClient({}, calls),
      companyId: 'demo-co',
    });
    await repo.loadCatalog();

    expect(calls).toHaveLength(6);
    expect(calls.every((c) => c.companyId === 'demo-co')).toBe(true);
    expect(calls.map((c) => c.table).sort()).toEqual([
      'pos_items',
      'pos_modifier_groups',
      'pos_modifiers',
      'pos_product_variants',
      'pos_products',
      'pos_recipe_lines',
    ]);
  });

  it('carries a dosing unit through only when the row has one', async () => {
    const line = (dosing: string | null) => ({
      id: 'r1', owner_id: 'v1', owner_type: 'variant', item_id: 'i1', qty: 2, dosing_unit_id: dosing,
    });
    const withUnit = await createSupabaseCatalogRepository({
      client: fakeClient({ pos_recipe_lines: [line('d1')] }), companyId: 'c1',
    }).loadCatalog();
    const without = await createSupabaseCatalogRepository({
      client: fakeClient({ pos_recipe_lines: [line(null)] }), companyId: 'c1',
    }).loadCatalog();

    expect(withUnit.recipeLines[0]?.dose).toEqual({ qty: 2, dosingUnitId: 'd1' });
    expect(without.recipeLines[0]?.dose).toEqual({ qty: 2 });
  });

  it('reports which table failed, not just that something did', async () => {
    const client = {
      from: (table: string) => ({
        select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }) }),
      }),
    } as never;
    await expect(
      createSupabaseCatalogRepository({ client, companyId: 'c1' }).loadCatalog(),
    ).rejects.toThrow(/Could not read pos_\w+: permission denied/);
  });
});
