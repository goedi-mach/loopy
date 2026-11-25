-- Veterinarians, managed from the admin Settings page.
-- • Active vets appear in the "Administered By" list when logging vaccines.
-- • The primary vet's name, license number and signature go on rabies certificates.
-- Signed-in users can read this table (certificates need it). Only admins can change it.
-- Vets are never deleted from the app (vaccination records keep their names); mark them inactive.
-- Idempotent: safe to run more than once.

create table if not exists public.vets (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                  -- as printed, e.g. 'Dr. Jane Doe'
  license_number text,                           -- printed on rabies certificates
  signature_path text,                           -- file name in the private 'signatures' bucket
  is_primary     boolean not null default false, -- signs rabies certificates
  active         boolean not null default true,  -- listed under "Administered By"
  created_at     timestamptz not null default now()
);

-- At most one primary vet
create unique index if not exists vets_one_primary on public.vets (is_primary) where is_primary;

alter table public.vets enable row level security;

drop policy if exists "vets_read" on public.vets;
create policy "vets_read" on public.vets
  for select to authenticated using (true);

drop policy if exists "vets_admin_insert" on public.vets;
create policy "vets_admin_insert" on public.vets
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "vets_admin_update" on public.vets;
create policy "vets_admin_update" on public.vets
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admins can upload signature images from the Settings page.
-- Each upload uses a new file name, so no update or delete policy is needed.
drop policy if exists "Admins can upload signatures" on storage.objects;
create policy "Admins can upload signatures" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'signatures' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
