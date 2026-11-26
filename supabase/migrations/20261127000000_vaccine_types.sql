-- Vaccine types move from the code (lib/vaccines.ts) into the database.
-- • key: stored on vaccine lots (vaccine_inventory.vaccine_type); never changes
-- • label: saved at the start of each vaccination's name ("DAPP 1 Year"); pages match a
--   pet's history by this first word, so don't rename a label once it has been used
-- • durations: the choices when logging, e.g. {"label":"1 Year","unit":"years","amount":1,"usda":"1yr"}
-- Signed-in users can read the list; only admins can change it.
-- Idempotent: safe to run more than once. Seeds the four standard vaccines only if missing.

create table if not exists public.vaccine_types (
  key        text primary key check (key ~ '^[a-z0-9_]+$'),
  label      text not null unique check (btrim(label) <> ''),
  species    text[] not null default '{dog,cat}' check (species <@ array['dog', 'cat'] and cardinality(species) > 0),
  is_rabies  boolean not null default false,   -- shows the rabies-certificate fields
  durations  jsonb not null default '[]'::jsonb check (jsonb_typeof(durations) = 'array'),
  sort_order int not null default 0,
  active     boolean not null default true,    -- inactive vaccines can't be logged, but history keeps them
  created_at timestamptz not null default now()
);

alter table public.vaccine_types enable row level security;

drop policy if exists "vaccine_types_read" on public.vaccine_types;
create policy "vaccine_types_read" on public.vaccine_types
  for select to authenticated using (true);

drop policy if exists "vaccine_types_admin_insert" on public.vaccine_types;
create policy "vaccine_types_admin_insert" on public.vaccine_types
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "vaccine_types_admin_update" on public.vaccine_types;
create policy "vaccine_types_admin_update" on public.vaccine_types
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- The four vaccines the app has always had, with the same keys, labels and durations
insert into public.vaccine_types (key, label, species, is_rabies, durations, sort_order) values
  ('dapp', 'DAPP', '{dog}', false,
   '[{"label":"4 Weeks","unit":"weeks","amount":4},{"label":"1 Year","unit":"months","amount":12},{"label":"3 Year","unit":"months","amount":36}]', 10),
  ('dapp_lepto', 'Lepto', '{dog}', false,
   '[{"label":"4 Weeks","unit":"weeks","amount":4},{"label":"1 Year","unit":"months","amount":12}]', 20),
  ('fvrcp', 'FVRCP', '{cat}', false,
   '[{"label":"4 Weeks","unit":"weeks","amount":4},{"label":"1 Year","unit":"months","amount":12},{"label":"3 Year","unit":"months","amount":36}]', 30),
  ('rabies', 'Rabies', '{dog,cat}', true,
   '[{"label":"1 Year","unit":"years","amount":1,"usda":"1yr"},{"label":"3 Year","unit":"years","amount":3,"usda":"3yr"}]', 40)
on conflict (key) do nothing;

-- Each lot now carries its product name (printed on rabies certificates) instead of
-- the app guessing it from the manufacturer code.
alter table public.vaccine_inventory add column if not exists product_name text;

-- Fill it in for existing rabies lots, using the mapping the app had built in
update public.vaccine_inventory
set product_name = case upper(btrim(manufacturer)) when 'MER' then 'IMRAB 3' when 'ELA' then 'RABVAC 3' end
where vaccine_type = 'rabies' and product_name is null and upper(btrim(manufacturer)) in ('MER', 'ELA');
