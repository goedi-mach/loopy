-- Starter email templates for a new install, written generically: the organization's
-- name, website and links come from Settings ({{org_name}}, {{website_link}}, ...).
-- Edit them afterwards on the Reminders page.
-- • The templates the emails need are added only where that template doesn't exist yet,
--   so an install that already has its own (like PHP's) keeps them unchanged.
-- • The starter add-on blocks (microchip, next clinic, spay/neuter) and their templates are
--   added only when the install has no add-ons (triggers) at all.
-- Idempotent: safe to run more than once.

insert into public.email_templates (id, subject, body) values
-- After a vaccine clinic (subject line shared by both languages; body per language)
('postclinic_vaccine_subject', $t$Thank you for visiting {{org_name}}! / ¡Gracias por visitar {{org_name}}!$t$, ''),
('postclinic_vaccine_en', $t$Thank you for visiting us, {{owner_name}}!$t$, $t$We're so glad you and your pet(s) came to our Vaccine Clinic on {{clinic_date}}.

📄 Please review the information sheet about possible vaccine reactions:
{{reaction_doc_en}}
{{reaction_doc_es}}

{{pet_due_dates_en}}

💰 If you ever need low-cost veterinary care or other support for your pet, this resource list is a good place to start:
{{lowcost_link}}$t$),
('postclinic_vaccine_es', $t$¡Gracias por visitarnos, {{owner_name}}!$t$, $t$Nos alegra mucho que usted y su(s) mascota(s) hayan venido a nuestra Clínica de Vacunas el {{clinic_date_es}}.

📄 Por favor revise la hoja informativa sobre posibles reacciones a las vacunas:
{{reaction_doc_en}}
{{reaction_doc_es}}

{{pet_due_dates_es}}

💰 Si alguna vez necesita atención veterinaria de bajo costo u otro apoyo para su mascota, esta lista de recursos es un buen punto de partida:
{{lowcost_link}}$t$),

-- After a booster clinic
('postclinic_booster_subject', $t$Thank you for visiting {{org_name}}! / ¡Gracias por visitar {{org_name}}!$t$, ''),
('postclinic_booster_en', $t$Thank you for visiting us, {{owner_name}}!$t$, $t$We're so glad you and your pet(s) came to our Booster Clinic on {{clinic_date}}.

📄 Please review the information sheet about possible vaccine reactions:
{{reaction_doc_en}}
{{reaction_doc_es}}

{{pet_due_dates_en}}

💰 If you ever need low-cost veterinary care or other support for your pet, this resource list is a good place to start:
{{lowcost_link}}

📅 Watch our website for upcoming clinics:
{{website_link}}$t$),
('postclinic_booster_es', $t$¡Gracias por visitarnos, {{owner_name}}!$t$, $t$Nos alegra mucho que usted y su(s) mascota(s) hayan venido a nuestra Clínica de Refuerzo el {{clinic_date_es}}.

📄 Por favor revise la hoja informativa sobre posibles reacciones a las vacunas:
{{reaction_doc_en}}
{{reaction_doc_es}}

{{pet_due_dates_es}}

💰 Si alguna vez necesita atención veterinaria de bajo costo u otro apoyo para su mascota, esta lista de recursos es un buen punto de partida:
{{lowcost_link}}

📅 Visite nuestra página web para ver las próximas clínicas:
{{website_link}}$t$),

-- Reminders two weeks before a vaccine is due
('reminder_2w_en', $t$Vaccine reminder for {{pet_name}} from {{org_name}}$t$, $t$Hi {{owner_name}},

This is a friendly reminder that {{pet_name}} is due for their {{vaccine}} vaccine around {{due_date}}. You can find our upcoming clinics on our website: {{website_link}}

We hope to see you soon!

Thank you,
{{org_name}}$t$),
('reminder_2w_es', $t$Recordatorio de vacuna para {{pet_name}} — {{org_name}}$t$, $t$Hola {{owner_name}},

Le recordamos que {{pet_name}} tiene pendiente su vacuna de {{vaccine}} alrededor del {{due_date}}. Puede ver nuestras próximas clínicas en nuestra página web: {{website_link}}

¡Esperamos verlos pronto!

Gracias,
{{org_name}}$t$),
('reminder_2w_en_booster', $t$Vaccine reminder for {{pet_name}} from {{org_name}}$t$, $t$Hi {{owner_name}},

This is a reminder that {{pet_name}} is due for their {{vaccine}} around {{due_date}}.{{clinic_date_line_en}}

Thank you,
{{org_name}}$t$),
('reminder_2w_es_booster', $t$Recordatorio de vacuna para {{pet_name}} — {{org_name}}$t$, $t$Hola {{owner_name}},

Le recordamos que {{pet_name}} tiene pendiente su vacuna de {{vaccine}} alrededor del {{due_date}}.{{clinic_date_line_es}}

Gracias,
{{org_name}}$t$),

-- Reminders one week before
('reminder_1w_en', $t$Upcoming vaccine for {{pet_name}} from {{org_name}}$t$, $t$Hi {{owner_name}},

This is a friendly reminder that {{pet_name}} is due for their {{vaccine}} vaccine around {{due_date}}. You can find our upcoming clinics on our website: {{website_link}}

We hope to see you soon!

Thank you,
{{org_name}}$t$),
('reminder_1w_es', $t$Vacuna próxima para {{pet_name}} — {{org_name}}$t$, $t$Hola {{owner_name}},

Le recordamos que {{pet_name}} tiene pendiente su vacuna de {{vaccine}} alrededor del {{due_date}}. Puede ver nuestras próximas clínicas en nuestra página web: {{website_link}}

¡Esperamos verlos pronto!

Gracias,
{{org_name}}$t$),
('reminder_1w_en_booster', $t$Upcoming vaccine for {{pet_name}} from {{org_name}}$t$, $t$Hi {{owner_name}},

This is a reminder that {{pet_name}} is due for their {{vaccine}} around {{due_date}}.{{clinic_date_line_en}}

Thank you,
{{org_name}}$t$),
('reminder_1w_es_booster', $t$Vacuna próxima para {{pet_name}} — {{org_name}}$t$, $t$Hola {{owner_name}},

Le recordamos que {{pet_name}} tiene pendiente su vacuna de {{vaccine}} alrededor del {{due_date}}.{{clinic_date_line_es}}

Gracias,
{{org_name}}$t$)
on conflict (id) do nothing;

-- Starter add-on blocks, only for an install that has none yet
do $$
begin
  if exists (select 1 from public.triggers) then
    return;
  end if;

  insert into public.email_templates (id, subject, body) values
  ('starter_microchip_en', $t$🔖 Register your pet's microchip!$t$,
   $t$Your pet received a microchip at our clinic. Register it so you can be reunited if they ever get lost:$t$),
  ('starter_microchip_es', $t$🔖 ¡Registre el microchip de su mascota!$t$,
   $t$Su mascota recibió un microchip en nuestra clínica. Regístrelo para que puedan reencontrarse si alguna vez se pierde:$t$),
  ('starter_next_clinic_en', $t$Upcoming Booster Clinic$t$,
   $t$Your pet has a vaccine due soon. Our next Booster Clinic is on {{next_booster_clinic}}. We hope to see you there!$t$),
  ('starter_next_clinic_es', $t$Próxima Clínica de Refuerzo$t$,
   $t$Su mascota tiene una vacuna pendiente pronto. Nuestra próxima Clínica de Refuerzo es el {{next_booster_clinic_es}}. ¡Esperamos verlos!$t$),
  ('starter_spay_neuter_en', $t$🐾 Interested in spay/neuter services?$t$,
   $t$Here is a list of affordable spay/neuter options: {{snip_link}}$t$),
  ('starter_spay_neuter_es', $t$🐾 ¿Le interesan los servicios de esterilización?$t$,
   $t$Aquí hay una lista de opciones de esterilización a bajo costo: {{snip_link}}$t$)
  on conflict (id) do nothing;

  insert into public.triggers (id, name, description, event, conditions, template_en, template_es) values
  ('starter_microchip', 'Microchip registration', 'Pets with a microchip: registration link', 'post_clinic',
   '{"has_microchip": true}', 'starter_microchip_en', 'starter_microchip_es'),
  ('starter_microchip_booster', 'Microchip registration (booster)', 'Pets with a microchip: registration link', 'post_booster',
   '{"has_microchip": true}', 'starter_microchip_en', 'starter_microchip_es'),
  ('starter_next_clinic', 'Next booster clinic', 'A vaccine is due before the next booster clinic', 'post_clinic',
   '{"has_upcoming_due": true}', 'starter_next_clinic_en', 'starter_next_clinic_es'),
  ('starter_spay_neuter', 'Spay/neuter resources', 'Clients with a pet that is not spayed or neutered', 'post_clinic',
   '{"has_intact_pet": true}', 'starter_spay_neuter_en', 'starter_spay_neuter_es'),
  ('starter_spay_neuter_booster', 'Spay/neuter resources (booster)', 'Clients with a pet that is not spayed or neutered', 'post_booster',
   '{"has_intact_pet": true}', 'starter_spay_neuter_en', 'starter_spay_neuter_es')
  on conflict (id) do nothing;
end $$;
