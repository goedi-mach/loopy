-- Editable waiver wording (Settings → Waiver), with a snapshot of the exact wording
-- saved alongside every signature, so a waiver PDF always shows what was actually signed
-- even after the wording changes.
-- • org_settings.waiver_en / waiver_es: paragraphs separated by a blank line;
--   {{org_name}} is replaced by the organization's name. Defaults are the wording the
--   app has always used.
-- • clients.waiver_text: {"org", "en", "es"} as signed. Existing signatures get the
--   current default wording (what they signed), with the name filled in at print time.
-- Idempotent: safe to run more than once.

alter table public.org_settings
  add column if not exists waiver_en text not null default $w$I, the undersigned, am using the medical services provided by {{org_name}} ("Clinic"). I understand that the Clinic is community-based and may include volunteer veterinarians, veterinary technicians, assistants, students, managers, and helpers.

I confirm that I am at least 18 years old and am legally authorized to make decisions for the animal(s) I am presenting today. I authorize the Clinic and its representatives to examine, vaccinate, microchip, and provide any other services I select or that are considered necessary.

I understand that these services do not replace full veterinary care and that the Clinic is not a full-service veterinary hospital. I am responsible for seeking and paying for any additional care recommended for my pet. I will inform Clinic staff, to the best of my knowledge, of any preexisting medical conditions, and I understand that some conditions may prevent my pet from receiving services.

I understand that vaccines and other services carry some risk. Mild side effects can include soreness, lethargy, or fever, while serious reactions are rare but possible and may require immediate veterinary attention.

I release and hold harmless {{org_name}}, including its directors, officers, volunteers, veterinarians, staff, and representatives, from liability for any injury, harm, or damage to me, my pet, or my personal property related to services provided at the Clinic.

I understand that photos or videos may be taken at Clinic events, and I give permission for {{org_name}} to use images of me, my pet, or others accompanying me for educational or promotional purposes. Anyone who does not wish to be photographed should let staff know at check-in.

I agree to receive email reminders from {{org_name}} regarding upcoming vaccinations for my pet(s). These reminders are sent as a courtesy and do not replace my responsibility to seek timely veterinary care.$w$,
  add column if not exists waiver_es text not null default $w$Yo, la persona abajo firmante, estoy utilizando los servicios médicos proporcionados por {{org_name}} ("la Clínica"). Entiendo que la Clínica es comunitaria y puede incluir veterinarios voluntarios, técnicos veterinarios, asistentes, estudiantes, administradores y ayudantes.

Confirmo que tengo al menos 18 años de edad y que estoy legalmente autorizado(a) para tomar decisiones por el/los animal(es) que presento hoy. Autorizo a la Clínica y a sus representantes a examinar, vacunar, colocar microchip y proporcionar cualquier otro servicio que seleccione o que se considere necesario.

Entiendo que estos servicios no reemplazan la atención veterinaria completa y que la Clínica no es un hospital veterinario de servicio completo. Soy responsable de buscar y pagar cualquier atención adicional recomendada para mi mascota. Informaré al personal de la Clínica, según mi conocimiento, sobre cualquier condición médica preexistente, y entiendo que algunas condiciones pueden impedir que mi mascota reciba ciertos servicios.

Entiendo que las vacunas y otros servicios conllevan algunos riesgos. Los efectos secundarios leves pueden incluir dolor en el sitio de aplicación, letargo o fiebre, mientras que las reacciones graves son poco comunes pero posibles y pueden requerir atención veterinaria inmediata.

Libero y eximo de responsabilidad a {{org_name}}, incluyendo a sus directores, oficiales, voluntarios, veterinarios, personal y representantes, por cualquier lesión, daño o perjuicio a mí, a mi mascota o a mi propiedad personal relacionado con los servicios proporcionados en la Clínica.

Entiendo que se pueden tomar fotos o videos durante los eventos de la Clínica, y doy permiso a {{org_name}} para utilizar imágenes mías, de mi mascota o de cualquier persona que me acompañe con fines educativos o promocionales. Las personas que no deseen ser fotografiadas deben informar al personal al momento del registro.

Acepto recibir recordatorios por correo electrónico de {{org_name}} sobre las vacunas próximas de mi(s) mascota(s). Estos recordatorios se envían como cortesía y no reemplazan mi responsabilidad de buscar atención veterinaria oportuna.$w$;

alter table public.clients
  add column if not exists waiver_text jsonb;

-- Pin every existing signature to the wording it was signed under
update public.clients
set waiver_text = jsonb_build_object('en', $w$I, the undersigned, am using the medical services provided by {{org_name}} ("Clinic"). I understand that the Clinic is community-based and may include volunteer veterinarians, veterinary technicians, assistants, students, managers, and helpers.

I confirm that I am at least 18 years old and am legally authorized to make decisions for the animal(s) I am presenting today. I authorize the Clinic and its representatives to examine, vaccinate, microchip, and provide any other services I select or that are considered necessary.

I understand that these services do not replace full veterinary care and that the Clinic is not a full-service veterinary hospital. I am responsible for seeking and paying for any additional care recommended for my pet. I will inform Clinic staff, to the best of my knowledge, of any preexisting medical conditions, and I understand that some conditions may prevent my pet from receiving services.

I understand that vaccines and other services carry some risk. Mild side effects can include soreness, lethargy, or fever, while serious reactions are rare but possible and may require immediate veterinary attention.

I release and hold harmless {{org_name}}, including its directors, officers, volunteers, veterinarians, staff, and representatives, from liability for any injury, harm, or damage to me, my pet, or my personal property related to services provided at the Clinic.

I understand that photos or videos may be taken at Clinic events, and I give permission for {{org_name}} to use images of me, my pet, or others accompanying me for educational or promotional purposes. Anyone who does not wish to be photographed should let staff know at check-in.

I agree to receive email reminders from {{org_name}} regarding upcoming vaccinations for my pet(s). These reminders are sent as a courtesy and do not replace my responsibility to seek timely veterinary care.$w$, 'es', $w$Yo, la persona abajo firmante, estoy utilizando los servicios médicos proporcionados por {{org_name}} ("la Clínica"). Entiendo que la Clínica es comunitaria y puede incluir veterinarios voluntarios, técnicos veterinarios, asistentes, estudiantes, administradores y ayudantes.

Confirmo que tengo al menos 18 años de edad y que estoy legalmente autorizado(a) para tomar decisiones por el/los animal(es) que presento hoy. Autorizo a la Clínica y a sus representantes a examinar, vacunar, colocar microchip y proporcionar cualquier otro servicio que seleccione o que se considere necesario.

Entiendo que estos servicios no reemplazan la atención veterinaria completa y que la Clínica no es un hospital veterinario de servicio completo. Soy responsable de buscar y pagar cualquier atención adicional recomendada para mi mascota. Informaré al personal de la Clínica, según mi conocimiento, sobre cualquier condición médica preexistente, y entiendo que algunas condiciones pueden impedir que mi mascota reciba ciertos servicios.

Entiendo que las vacunas y otros servicios conllevan algunos riesgos. Los efectos secundarios leves pueden incluir dolor en el sitio de aplicación, letargo o fiebre, mientras que las reacciones graves son poco comunes pero posibles y pueden requerir atención veterinaria inmediata.

Libero y eximo de responsabilidad a {{org_name}}, incluyendo a sus directores, oficiales, voluntarios, veterinarios, personal y representantes, por cualquier lesión, daño o perjuicio a mí, a mi mascota o a mi propiedad personal relacionado con los servicios proporcionados en la Clínica.

Entiendo que se pueden tomar fotos o videos durante los eventos de la Clínica, y doy permiso a {{org_name}} para utilizar imágenes mías, de mi mascota o de cualquier persona que me acompañe con fines educativos o promocionales. Las personas que no deseen ser fotografiadas deben informar al personal al momento del registro.

Acepto recibir recordatorios por correo electrónico de {{org_name}} sobre las vacunas próximas de mi(s) mascota(s). Estos recordatorios se envían como cortesía y no reemplazan mi responsabilidad de buscar atención veterinaria oportuna.$w$)
where waiver_signature is not null and waiver_text is null;

-- register_visit: also saves the wording being signed (otherwise unchanged)
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
  v_today date := public.org_today();  -- the organization's time zone (Settings)
  v_waiver jsonb;  -- the exact waiver wording being signed (Settings → Waiver)
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

  -- The waiver wording being signed right now, with the organization's name filled in
  select jsonb_build_object(
           'org', org_name,
           'en', replace(waiver_en, '{{org_name}}', org_name),
           'es', replace(waiver_es, '{{org_name}}', org_name))
    into v_waiver
    from org_settings limit 1;

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
      waiver_signature = v_sig,
      waiver_text = v_waiver
    where id = v_client;
  else
    insert into clients (name, email, phone, street, city, state, zip, preferred_language,
                         event_date, status, waiver_signed_at, waiver_signature, waiver_text)
    values (v_name, v_email, v_phone, v_street, v_city, v_state, v_zip, v_lang,
            v_today, 'registered', now(), v_sig, v_waiver)
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
-- merge_clients: the waiver wording moves together with the signature it belongs to (otherwise unchanged)
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
    waiver_signed_at   = case when a.waiver_signature is not null then a.waiver_signed_at else b.waiver_signed_at end,
    waiver_text        = case when a.waiver_signature is not null then a.waiver_text else b.waiver_text end
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