-- 1. The history table
create table public.vaccination_history (
  id               bigint generated always as identity primary key,
  vaccination_id   uuid not null,
  pet_id           uuid,
  action           text not null check (action in ('UPDATE', 'DELETE')),
  changed_at       timestamptz not null default now(),
  changed_by       uuid,
  changed_by_email text,
  changed_fields   text[],
  old_row          jsonb not null,
  new_row          jsonb
);

create index vaccination_history_vaccination_idx on public.vaccination_history (vaccination_id);
create index vaccination_history_pet_idx on public.vaccination_history (pet_id);

-- 2. The rule that fills it in automatically
create or replace function public.log_vaccination_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_j   jsonb := to_jsonb(OLD);
  new_j   jsonb;
  changed text[];
begin
  if TG_OP = 'UPDATE' then
    new_j := to_jsonb(NEW);
    select array_agg(n.key order by n.key) into changed
    from jsonb_each(new_j) n
    where n.value is distinct from old_j -> n.key;

    -- Skip saves that changed nothing, or only the "reminder sent" flags
    if changed is null or changed <@ array['reminder_2w_sent', 'reminder_1w_sent'] then
      return null;
    end if;
  end if;

  insert into public.vaccination_history
    (vaccination_id, pet_id, action, changed_by, changed_by_email, changed_fields, old_row, new_row)
  values
    (OLD.id, OLD.pet_id, TG_OP, auth.uid(), auth.jwt() ->> 'email', changed, old_j, new_j);

  return null;
end;
$$;

revoke execute on function public.log_vaccination_change() from public, anon, authenticated;

create trigger vaccination_history_log
  after update or delete on public.vaccinations
  for each row execute function public.log_vaccination_change();

-- 3. Who can see it: staff and admins can read; nobody can edit or delete history
alter table public.vaccination_history enable row level security;

create policy "staff and admin can read vaccination history"
  on public.vaccination_history for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));