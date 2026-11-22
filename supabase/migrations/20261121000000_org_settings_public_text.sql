-- Organization-specific text for the public home page, edited from the Settings page.
-- When a field is empty, the app shows generic text instead.
-- Idempotent: safe to run more than once.

alter table public.org_settings
  add column if not exists intro_en   text,   -- home page introduction, English
  add column if not exists intro_es   text,   -- home page introduction, Spanish
  add column if not exists tagline_en text,   -- footer tagline, English
  add column if not exists tagline_es text,   -- footer tagline, Spanish
  add column if not exists events_url text;   -- link to the organization's upcoming clinics page
