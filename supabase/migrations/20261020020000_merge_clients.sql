-- Merge two client records in a single transaction.
-- Staff and admin only. Everything of B's moves to A, then B is deleted.
create or replace function public.merge_clients(keep_id uuid, drop_id uuid, fields jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.clients%rowtype;
  b public.clients%rowtype;
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
begin
  if jwt_role not in ('staff', 'admin') then
    raise exception 'Only staff can merge clients';
  end if;
  if keep_id = drop_id then
    raise exception 'Cannot merge a client into itself';
  end if;

  select * into a from public.clients where id = keep_id for update;
  if not found then raise exception 'Client A was not found'; end if;
  select * into b from public.clients where id = drop_id for update;
  if not found then raise exception 'Client B was not found'; end if;

  update public.clients set
    name       = coalesce(nullif(fields->>'name', ''), a.name),
    phone      = nullif(fields->>'phone', ''),
    email      = nullif(fields->>'email', ''),
    street     = nullif(fields->>'street', ''),
    city       = nullif(fields->>'city', ''),
    state      = nullif(fields->>'state', ''),
    zip        = nullif(fields->>'zip', ''),
    event_date = nullif(fields->>'event_date', '')::date,
    notes      = nullif(concat_ws(E'\n\n---\n\n', nullif(trim(a.notes), ''), nullif(trim(b.notes), '')), ''),
    address    = coalesce(a.address, b.address),
    preferred_language = coalesce(a.preferred_language, b.preferred_language),
    snip_interest      = a.snip_interest or b.snip_interest,
    waiver_signature   = case when a.waiver_signature is not null then a.waiver_signature else b.waiver_signature end,
    waiver_signed_at   = case when a.waiver_signature is not null then a.waiver_signed_at else b.waiver_signed_at end
  where id = keep_id;

  update public.pets                set client_id = keep_id where client_id = drop_id;
  update public.attachments         set client_id = keep_id where client_id = drop_id;
  update public.email_events        set client_id = keep_id where client_id = drop_id;
  update public.email_send_failures set client_id = keep_id where client_id = drop_id;

  -- Same client + date + clinic type can only be logged once, so drop B's duplicates first
  delete from public.postclinic_email_log x
  using public.postclinic_email_log k
  where x.client_id = drop_id and k.client_id = keep_id
    and k.event_date = x.event_date and k.clinic_type = x.clinic_type;
  update public.postclinic_email_log set client_id = keep_id where client_id = drop_id;

  delete from public.clients where id = drop_id;
end;
$$;

revoke all on function public.merge_clients(uuid, uuid, jsonb) from public, anon;
grant execute on function public.merge_clients(uuid, uuid, jsonb) to authenticated;