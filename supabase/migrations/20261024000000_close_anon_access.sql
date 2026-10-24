-- Close the old public (anonymous) database access.
-- Applied to the live project on 2026-10-24 after the React cutover.
-- The public registration form uses the register_visit() function only.
-- Idempotent: safe to run more than once.

-- 1. Remove anonymous access to client data.
drop policy if exists "public can insert clients" on public.clients;
drop policy if exists "anon can select clients" on public.clients;
drop policy if exists "anon can update clients" on public.clients;
drop policy if exists "Anon can read clients for queue display" on public.clients;

drop policy if exists "public can insert pets" on public.pets;
drop policy if exists "anon can select pets" on public.pets;
drop policy if exists "anon can update pets" on public.pets;

drop policy if exists "anon can select vaccinations" on public.vaccinations;
drop policy if exists "anon can delete vaccinations" on public.vaccinations;

-- 2. Email and trigger tables: signed-in users only.
--    Writes come from serverless functions using the service-role key (bypasses RLS).
drop policy if exists "email_events_select" on public.email_events;
create policy "email_events_select" on public.email_events
  for select to authenticated using (true);

drop policy if exists "email_send_failures_select" on public.email_send_failures;
create policy "email_send_failures_select" on public.email_send_failures
  for select to authenticated using (true);

drop policy if exists "reminder_email_log_select" on public.reminder_email_log;
create policy "reminder_email_log_select" on public.reminder_email_log
  for select to authenticated using (true);

drop policy if exists "postclinic_log_select" on public.postclinic_email_log;
create policy "postclinic_log_select" on public.postclinic_email_log
  for select to authenticated using (true);

drop policy if exists "postclinic_log_insert" on public.postclinic_email_log;

drop policy if exists "triggers_select" on public.triggers;
create policy "triggers_select" on public.triggers
  for select to authenticated using (true);

-- 3. pet_next_due must respect the caller's RLS, and is not public.
alter view public.pet_next_due set (security_invoker = true);
revoke all on public.pet_next_due from anon;

-- 4. Function hardening.
alter function public.search_clients_unaccent(text) set search_path = public, pg_temp;
alter function public.set_vaccination_created_by() set search_path = public, pg_temp;
revoke execute on function public.set_vaccination_created_by() from public, anon, authenticated;
