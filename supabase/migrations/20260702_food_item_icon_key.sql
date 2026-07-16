alter table public.food_items
  add column if not exists icon_key text;

create index if not exists food_items_icon_key_idx
  on public.food_items (icon_key)
  where icon_key is not null;

comment on column public.food_items.icon_key is
  'Optional visual icon key used by Stryv Lab food illustration components.';
