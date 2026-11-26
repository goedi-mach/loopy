-- Email settings, edited on the Settings page (Emails section) and read by the
-- serverless email functions (api/_org.js). Empty fields are simply left out of emails,
-- except the "From" address, which is required for sending.
-- Idempotent: safe to run more than once.

alter table public.org_settings
  add column if not exists email_from             text,  -- sender address; its domain must be verified in Resend
  add column if not exists resources_url          text,  -- spay/neuter & low-cost care resources ({{snip_link}}, {{lowcost_link}})
  add column if not exists take_home_en_url       text,  -- after-vaccine take-home sheet, English ({{reaction_doc_en}})
  add column if not exists take_home_es_url       text,  -- after-vaccine take-home sheet, Spanish ({{reaction_doc_es}})
  add column if not exists microchip_register_url text;  -- chip registration link; {chip} is replaced by the chip number

alter table public.org_settings drop constraint if exists org_settings_email_from_check;
alter table public.org_settings add constraint org_settings_email_from_check
  check (email_from is null or email_from ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$');
