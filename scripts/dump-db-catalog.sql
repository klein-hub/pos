-- Prints the database's catalog in exactly the shape scripts/dump-seed-catalog.ts
-- produces, so the two can be diffed. Addressed by name, sorted, numbers fixed
-- to the same precision.
-- Invoked with -At (tuples only, unaligned); setting those with \pset here
-- would echo confirmations into stdout and corrupt the JSON.

select jsonb_pretty(jsonb_build_object(
  'items', (
    select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
      select jsonb_build_object(
        'name', i.name,
        'category', i.category,
        'itemType', i.item_type::text,
        'baseUnit', i.base_unit::text,
        'purchaseUnit', i.purchase_unit,
        'packSize', round(i.pack_size, 4)::float8,
        'prepYieldQty', case when i.prep_yield_qty is null then null
                             else round(i.prep_yield_qty, 4)::float8 end,
        'unitCost', case when i.standard_unit_cost is null then null
                         else round(i.standard_unit_cost, 6)::float8 end
      ) as x
      from pos_items i where i.company_id = :'company'
    ) s
  ),
  'products', (
    select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
      select jsonb_build_object(
        'name', p.name, 'category', p.category, 'productType', p.product_type::text
      ) as x from pos_products p where p.company_id = :'company'
    ) s
  ),
  'variants', (
    select coalesce(jsonb_agg(x order by x->>'product', x->>'size'), '[]'::jsonb) from (
      select jsonb_build_object(
        'product', p.name,
        'size', v.size,
        'sellingPrice', v.selling_price,
        'targetMarginPct', case when v.target_margin_pct is null then null
                                else round(v.target_margin_pct, 2)::float8 end
      ) as x
      from pos_product_variants v
      join pos_products p on p.id = v.product_id
      where v.company_id = :'company'
    ) s
  ),
  'modifiers', (
    select coalesce(jsonb_agg(x order by coalesce(x->>'product','-'), x->>'group', x->>'name'), '[]'::jsonb) from (
      select jsonb_build_object(
        'product', p.name, 'group', g.name, 'name', m.name, 'priceDelta', m.price_delta
      ) as x
      from pos_modifiers m
      join pos_modifier_groups g on g.id = m.group_id
      left join pos_products p on p.id = g.product_id
      where m.company_id = :'company'
    ) s
  ),
  'recipeLines', (
    select coalesce(jsonb_agg(x order by x->>'owner', x->>'item'), '[]'::jsonb) from (
      select jsonb_build_object(
        'owner', case rl.owner_type
          when 'variant'  then 'variant:'  || vp.name || '/' || v.size
          when 'modifier' then 'modifier:' || coalesce(mp.name, '-') || '/' || g.name || '/' || m.name
          else 'prep:' || owner_item.name
        end,
        'item', ing.name,
        'qty', round(rl.qty, 4)::float8
      ) as x
      from pos_recipe_lines rl
      join pos_items ing on ing.id = rl.item_id
      left join pos_product_variants v on v.id = rl.owner_id and rl.owner_type = 'variant'
      left join pos_products vp on vp.id = v.product_id
      left join pos_modifiers m on m.id = rl.owner_id and rl.owner_type = 'modifier'
      left join pos_modifier_groups g on g.id = m.group_id
      left join pos_products mp on mp.id = g.product_id
      left join pos_items owner_item on owner_item.id = rl.owner_id and rl.owner_type = 'prep'
      where rl.company_id = :'company'
    ) s
  )
));
