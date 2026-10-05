-- =============================================================================
-- Digita POS — reference cost on items
--
-- Batch cost is the truth once receipts exist, but on day one there are no
-- batches and the shop still has a price list. standard_unit_cost holds that
-- list price so recipes cost something real from the first minute, and the
-- stock view falls back to it only when no batch has ever been received.
--
-- Fallback order in pos_item_stock.avg_unit_cost:
--   1. weighted average of remaining stock       (live)
--   2. cost of the most recent batch, even if empty
--   3. standard_unit_cost                        (price list)
-- =============================================================================

begin;

alter table public.pos_items
  add column standard_unit_cost numeric(14, 6) check (standard_unit_cost >= 0);

comment on column public.pos_items.standard_unit_cost is
  'Reference cost per base unit from the price list. Used only until a batch exists.';

create or replace view public.pos_item_stock as
select
  i.id                                                as item_id,
  i.company_id,
  i.name,
  i.category,
  i.base_unit,
  i.purchase_unit,
  i.pack_size,
  i.reorder_point,
  i.par_level,
  coalesce(sum(b.qty_remaining), 0)                   as on_hand,
  coalesce(sum(b.qty_remaining) filter (where b.is_open), 0)      as open_qty,
  coalesce(sum(b.qty_remaining) filter (where not b.is_open), 0)  as sealed_qty,
  coalesce(
    case
      when coalesce(sum(b.qty_remaining), 0) > 0
        then sum(b.qty_remaining * b.unit_cost) / sum(b.qty_remaining)
    end,
    (
      select b2.unit_cost from public.pos_stock_batches b2
      where b2.item_id = i.id order by b2.received_at desc limit 1
    ),
    i.standard_unit_cost
  )                                                   as avg_unit_cost,
  min(b.expiry_date) filter (where b.qty_remaining > 0) as next_expiry,
  -- Tells the UI whether the number is measured or merely listed. Appended
  -- last on purpose: CREATE OR REPLACE VIEW can only add columns at the end,
  -- so inserting it mid-list would make this migration unrunnable.
  case
    when coalesce(sum(b.qty_remaining), 0) > 0 then 'batch'
    when exists (select 1 from public.pos_stock_batches b3 where b3.item_id = i.id) then 'last_batch'
    when i.standard_unit_cost is not null then 'standard'
    else 'none'
  end                                                 as cost_source
from public.pos_items i
left join public.pos_stock_batches b
  on b.item_id = i.id and b.qty_remaining > 0
where i.is_active
group by i.id;

alter view public.pos_item_stock set (security_invoker = true);

commit;
