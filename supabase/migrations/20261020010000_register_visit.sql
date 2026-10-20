create or replace function public.register_visit(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb := payload -> 'client';
  pet_list jsonb := coalesce(payload -> 'pets', '[]'::jsonb);
  p jsonb;
  v_name text := left(nullif(btrim(c ->> 'name'), ''), 200);
  v_email text := left(nullif(btrim(c ->> 'email'), ''), 200);
  v_phone text := left(nullif(btrim(c ->> 'phone'), ''), 40);
  v_street text := left(nullif(btrim(c ->> 'street'), ''), 200);
  v_city text := left(nullif(btrim(c ->> 'city'), ''), 100);
  v_state text := left(upper(nullif(btrim(c ->> 'state'), '')), 2);
  v_zip text := left(nullif(btrim(c ->> 'zip'), ''), 10);
  v_lang text := c ->> 'preferred_language';
  v_sig text := c ->> 'waiver_signature';
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_client uuid;
  v_pet uuid;
  v_pet_name text;
  v_species text;
  n int := 0;
begin
  if v_name is null then raise exception 'Name is required'; end if;
  if coalesce(v_lang, '') not in ('en', 'es') then raise exception 'Preferred language is required'; end if;
  if v_sig is null or v_sig not like 'data:image/png;base64,%' or length(v_sig) > 500000 then
    raise exception 'A signature is required';
  end if;
  if jsonb_typeof(pet_list) <> 'array' or jsonb_array_length(pet_list) < 1 or jsonb_array_length(pet_list) > 3 then
    raise exception 'One to three pets are required';
  end if;

  -- Existing client? Match on email (any capitalization) or phone.
  select id into v_client from clients
  where (v_email is not null and lower(email) = lower(v_email))
     or (v_phone is not null and phone = v_phone)
  order by created_at desc
  limit 1;

  if v_client is not null then
    -- Never overwrite what is already on file; only fill blanks and record this visit.
    update clients set
      email = coalesce(email, v_email),
      phone = coalesce(phone, v_phone),
      street = coalesce(street, v_street),
      city = coalesce(city, v_city),
      state = coalesce(state, v_state),
      zip = coalesce(zip, v_zip),
      preferred_language = v_lang,
      event_date = v_today,
      status = 'registered',
      waiver_signed_at = now(),
      waiver_signature = v_sig
    where id = v_client;
  else
    insert into clients (name, email, phone, street, city, state, zip, preferred_language,
                         event_date, status, waiver_signed_at, waiver_signature)
    values (v_name, v_email, v_phone, v_street, v_city, v_state, v_zip, v_lang,
            v_today, 'registered', now(), v_sig)
    returning id into v_client;
  end if;

  for p in select value from jsonb_array_elements(pet_list) loop
    v_pet_name := left(nullif(btrim(p ->> 'name'), ''), 100);
    continue when v_pet_name is null;
    v_species := p ->> 'species';
    if coalesce(v_species, '') not in ('dog', 'cat') then
      raise exception 'Species must be dog or cat';
    end if;
    n := n + 1;

    v_pet := null;
    select id into v_pet from pets
    where client_id = v_client and lower(name) = lower(v_pet_name)
    limit 1;

    if v_pet is not null then
      -- Fill blanks; never touch the microchip number
      update pets set
        breed = coalesce(breed, left(nullif(btrim(p ->> 'breed'), ''), 100)),
        age = coalesce((p ->> 'age')::numeric, age),
        age_unit = case when (p ->> 'age') is not null then coalesce(p ->> 'age_unit', 'years') else age_unit end,
        weight = coalesce((p ->> 'weight')::numeric, weight),
        sex = case when coalesce(sex, 'unknown') = 'unknown' then coalesce(p ->> 'sex', 'unknown') else sex end,
        altered = case when coalesce(altered, 'unknown') = 'unknown' then coalesce(p ->> 'altered', 'unknown') else altered end,
        microchipped = case when coalesce(microchipped, 'unknown') = 'unknown' then coalesce(p ->> 'microchipped', 'unknown') else microchipped end,
        colors_markings = coalesce(colors_markings, left(nullif(btrim(p ->> 'colors_markings'), ''), 200))
      where id = v_pet;
    else
      insert into pets (client_id, name, species, breed, age, age_unit, weight, sex, altered, microchipped, colors_markings)
      values (
        v_client, v_pet_name, v_species,
        left(nullif(btrim(p ->> 'breed'), ''), 100),
        (p ->> 'age')::numeric,
        coalesce(p ->> 'age_unit', 'years'),
        (p ->> 'weight')::numeric,
        coalesce(p ->> 'sex', 'unknown'),
        coalesce(p ->> 'altered', 'unknown'),
        coalesce(p ->> 'microchipped', 'unknown'),
        left(nullif(btrim(p ->> 'colors_markings'), ''), 200)
      );
    end if;
  end loop;

  if n = 0 then raise exception 'At least one pet is required'; end if;
end;
$$;

revoke all on function public.register_visit(jsonb) from public;
grant execute on function public.register_visit(jsonb) to anon, authenticated;