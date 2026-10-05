-- =============================================================================
-- Digita POS — close a hole in the one-open-container rule
--
-- pos_batches_one_open_per_item was a partial unique index on
-- (item_id, location_id) with location_id nullable. Postgres treats NULLs as
-- distinct in a unique index, so an item could hold an open container at a
-- location AND another open container with no location at all. "N sealed plus
-- one open" is the premise the FEFO draw-down rests on, so it has to be
-- absolute.
--
-- NULLS NOT DISTINCT does not fix this: it makes two NULLs equal to each
-- other, not equal to a real location. The actual defect is the nullable
-- column — a batch of stock always physically sits somewhere. Making
-- location_id mandatory removes the ambiguity at its source rather than
-- patching the index around it.
--
-- Caught by scripts/test-schema.sql.
-- =============================================================================

begin;

-- Any batch recorded before this migration gets its company's first location;
-- a company with no location at all gets one, since stock cannot be nowhere.
insert into public.pos_locations (company_id, name)
select distinct b.company_id, 'Main Store'
from public.pos_stock_batches b
where b.location_id is null
  and not exists (select 1 from public.pos_locations l where l.company_id = b.company_id);

update public.pos_stock_batches b
set location_id = (
  select l.id from public.pos_locations l
  where l.company_id = b.company_id
  order by l.created_at
  limit 1
)
where b.location_id is null;

-- SET NULL would silently re-open the hole the moment a location was deleted.
alter table public.pos_stock_batches
  drop constraint pos_stock_batches_location_id_fkey;

alter table public.pos_stock_batches
  alter column location_id set not null;

alter table public.pos_stock_batches
  add constraint pos_stock_batches_location_id_fkey
  foreign key (location_id) references public.pos_locations (id) on delete restrict;

-- Both columns are now NOT NULL, so ordinary uniqueness is enough.
drop index if exists public.pos_batches_one_open_per_item;

create unique index pos_batches_one_open_per_item
  on public.pos_stock_batches (item_id, location_id)
  where is_open;

commit;
