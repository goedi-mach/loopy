-- Organization settings: one row holding the clinic's name, contact info, branding
-- and defaults, edited from the admin Settings page (/tools/settings).
-- Everyone can read it (the public landing and registration pages show the name and
-- logo). Only admins can change it. Never put secrets in this table.
-- Idempotent: safe to run more than once.

create table if not exists public.org_settings (
  id               boolean primary key default true check (id),  -- allows exactly one row
  org_name         text not null default 'My Clinic',
  city_region      text,                                         -- e.g. 'Chicago, IL'
  website_url      text,
  contact_email    text,
  logo_url         text,                                         -- empty = built-in /logo.png
  primary_color    text not null default '#1a3a8f' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color     text not null default '#f28b82' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  default_language text not null default 'en' check (default_language in ('en', 'es')),
  updated_at       timestamptz not null default now()
);

alter table public.org_settings enable row level security;

drop policy if exists "org_settings_read" on public.org_settings;
create policy "org_settings_read" on public.org_settings
  for select to anon, authenticated using (true);

drop policy if exists "org_settings_admin_update" on public.org_settings;
create policy "org_settings_admin_update" on public.org_settings
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- The single row. Set the real values from the Settings page afterwards.
insert into public.org_settings (id) values (true) on conflict (id) do nothing;

-- Public bucket for the uploaded logo (emails and public pages need to load it).
-- Only admins can upload. Each upload uses a new file name, so no update policy is needed.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "Admins can upload branding" on storage.objects;
create policy "Admins can upload branding" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
