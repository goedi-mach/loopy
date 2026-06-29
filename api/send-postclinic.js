const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const FROM_EMAIL           = 'reminders@peoplehelpingpets.org';

const REACTION_DOC_EN = 'https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/VaccineTakeHome_ENG.pdf';
const REACTION_DOC_ES = 'https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/VacunasHojaInfo_ESP.pdf';
const SNIP_LINK       = 'https://www.chicago.gov/content/dam/city/depts/cacc/PDFiles/CACC%20Resource%20List.pdf';
const LOWCOST_LINK    = 'https://www.chicago.gov/content/dam/city/depts/cacc/PDFiles/CACC%20Resource%20List.pdf';
const WEBSITE_LINK    = 'https://peoplehelpingpets.org';

// ─── SUPABASE HELPER ───────────────────────────────────────────
async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  return res.json();
}

// ─── TEMPLATE VARIABLE SUBSTITUTION ───────────────────────────
function fill(str, vars) {
  return (str || '')
    .replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '')
    .replace(/\\n/g, '<br>');
}

// ─── LOAD TRIGGERS FOR AN EVENT TYPE ──────────────────────────
async function loadTriggers(event) {
  const rows = await sbFetch(
    `triggers?event=eq.${encodeURIComponent(event)}&active=eq.true&order=created_at.asc`
  );
  return Array.isArray(rows) ? rows : [];
}

// ─── LOAD A SINGLE EMAIL TEMPLATE ─────────────────────────────
async function loadTemplate(id) {
  const rows = await sbFetch(`email_templates?id=eq.${id}&select=id,subject,body`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// ─── LOAD MAIN EMAIL TEMPLATES (subject + EN/ES body) ─────────
async function getMainTemplates(prefix) {
  const ids = [`${prefix}_subject`, `${prefix}_en`, `${prefix}_es`];
  const map = {};
  await Promise.all(ids.map(async id => {
    const rows = await sbFetch(`email_templates?id=eq.${id}&select=id,subject,body`);
    if (Array.isArray(rows) && rows[0]) map[id] = rows[0];
  }));
  return map;
}

// ─── CONDITION EVALUATOR ───────────────────────────────────────
// Supported conditions (all are optional; omitting one means "no restriction"):
//   has_intact_pet  — true: client has any pet with altered = 'no' or 'unknown'
//   has_microchip   — true: client has any pet with a microchip_number
//   zip             — array of ZIP strings: client's ZIP must be in the list
//   clinic_type     — 'Vaccine Clinic' | 'Booster Clinic' (matches the event's clinicType)
//   preferred_language — 'en' | 'es'
function evaluateConditions(conditions, client, clientPets, clinicType, hasUpcomingDue) {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  if ('has_intact_pet' in conditions && conditions.has_intact_pet === true) {
    const hasIntact = clientPets.some(
      p => p.altered === 'no' || p.altered === 'unknown'
    );
    if (!hasIntact) return false;
  }

  if ('has_microchip' in conditions && conditions.has_microchip === true) {
    const hasChip = clientPets.some(p => !!p.microchip_number);
    if (!hasChip) return false;
  }

  if ('has_upcoming_due' in conditions && conditions.has_upcoming_due === true) {
    if (!hasUpcomingDue) return false;
  }

  if ('zip' in conditions && Array.isArray(conditions.zip)) {
    const clientZip = (client.zip || '').trim();
    if (!conditions.zip.includes(clientZip)) return false;
  }

  if ('clinic_type' in conditions) {
    if (conditions.clinic_type !== clinicType) return false;
  }

  if ('preferred_language' in conditions) {
    if (conditions.preferred_language !== client.preferred_language) return false;
  }

  return true;
}

// ─── BUILD TRIGGER BLOCK HTML ──────────────────────────────────
// Each trigger renders an EN block and an ES block.
// chip_links is a special variable computed per-client.
function buildTriggerBlock(tplEn, tplEs, vars, includeChipList) {
  if (!tplEn && !tplEs) return { en: '', es: '' };

  const en = tplEn ? `
    <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
    <p><strong>${fill(tplEn.subject, vars)}</strong></p>
    <p>${fill(tplEn.body, vars)}</p>
    ${includeChipList && vars.chip_links ? `<ul style="margin:0.5rem 0 0 1rem;">${vars.chip_links}</ul>` : ''}
  ` : '';

  const es = tplEs ? `
    <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
    <p><strong>${fill(tplEs.subject, vars)}</strong></p>
    <p>${fill(tplEs.body, vars)}</p>
    ${includeChipList && vars.chip_links ? `<ul style="margin:0.5rem 0 0 1rem;">${vars.chip_links}</ul>` : ''}
  ` : '';

  return { en, es };
}

// ─── NEXT BOOSTER CLINIC ───────────────────────────────────────
async function getNextBoosterClinic(afterDate) {
  const records = await sbFetch(
    `events?clinic_type=eq.Booster Clinic&completed=eq.false&event_date=gt.${afterDate}&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || !records.length) return null;
  const e    = records[0];
  const date = new Date(e.event_date + 'T12:00:00');
  return {
    date: e.event_date, // raw ISO date string, used for due-date cutoff comparisons
    en: `${date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })} at ${e.location}`,
    es: `${date.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} en ${e.location}`,
  };
}

// ─── DUE DATE BLOCK ────────────────────────────────────────────
function buildDueDates(pets, vaccinations) {
  const today = new Date().toISOString().split('T')[0];
  const byPet = {};
  vaccinations.forEach(v => {
    if (!v.next_due || v.next_due <= today) return;
    if (!byPet[v.pet_id]) byPet[v.pet_id] = [];
    byPet[v.pet_id].push(v);
  });

  const lines = [];
  pets.forEach(pet => {
    const vaxes = byPet[pet.id];
    if (!vaxes || !vaxes.length) return;
    const items = vaxes.map(v => ({
      name: v.vaccine_name,
      due:  new Date(v.next_due + 'T12:00:00')
    })).sort((a, b) => a.due - b.due);
    lines.push({ petName: pet.name, items });
  });

  if (!lines.length) return { en: '', es: '' };

  const fmtEn = d => d.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
  const fmtEs = d => d.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });

  const enLines = lines.map(l =>
    `<li><strong>${l.petName}:</strong> ${l.items.map(i => `${i.name} due ${fmtEn(i.due)}`).join(' · ')}</li>`
  ).join('');
  const esLines = lines.map(l =>
    `<li><strong>${l.petName}:</strong> ${l.items.map(i => `${i.name} vence ${fmtEs(i.due)}`).join(' · ')}</li>`
  ).join('');

  return {
    en: `📅 <strong>Your pet's upcoming vaccine due dates:</strong><ul style="margin:0.5rem 0 0 1rem;">${enLines}</ul>`,
    es: `📅 <strong>Fechas próximas de vacunas de su mascota:</strong><ul style="margin:0.5rem 0 0 1rem;">${esLines}</ul>`,
  };
}

// ─── SEND EMAIL ────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Resend error');
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { eventDate, clinicType, preview } = req.body;
  if (!eventDate) return res.status(400).json({ error: 'eventDate is required' });

  const isBooster  = clinicType === 'Booster Clinic';
  const prefix     = isBooster ? 'postclinic_booster' : 'postclinic_vaccine';
  const triggerEvent = isBooster ? 'post_booster' : 'post_clinic';

  try {
    // Load main templates and active triggers in parallel
    const [tpl, triggers] = await Promise.all([
      getMainTemplates(prefix),
      loadTriggers(triggerEvent),
    ]);

    // Pre-load all trigger templates in parallel (EN + ES for each trigger)
    const triggerTemplates = {};
    await Promise.all(triggers.flatMap(t => [
      loadTemplate(t.template_en).then(r => { triggerTemplates[t.template_en] = r; }),
      loadTemplate(t.template_es).then(r => { triggerTemplates[t.template_es] = r; }),
    ]));

    // Pull clients (include zip and preferred_language for condition evaluation)
    const clients = await sbFetch(
      `clients?event_date=eq.${eventDate}&archived=eq.false` +
      `&select=id,name,email,zip,preferred_language&limit=5000`
    );
    if (!Array.isArray(clients)) throw new Error('Could not load clients');

    const clientIds = clients.map(c => c.id);
    if (!clientIds.length) return res.status(200).json({ ok: true, sent: 0, skipped: 0 });

    // Pull pets (altered + microchip_number needed for condition evaluation)
    const pets = await sbFetch(
      `pets?client_id=in.(${clientIds.join(',')})&archived=eq.false` +
      `&select=id,client_id,name,microchip_number,altered&limit=5000`
    );
    if (!Array.isArray(pets)) throw new Error('Could not load pets');

    // Pull future vaccinations for due-date block
    const petIds = pets.map(p => p.id);
    const today  = new Date().toISOString().split('T')[0];
    const vaccinations = petIds.length ? await sbFetch(
      `vaccinations?pet_id=in.(${petIds.join(',')})&next_due=gt.${today}` +
      `&select=pet_id,vaccine_name,next_due&limit=5000`
    ) : [];

    // Group pets by client
    const petsByClient = {};
    pets.forEach(p => {
      if (!petsByClient[p.client_id]) petsByClient[p.client_id] = [];
      petsByClient[p.client_id].push(p);
    });

    // Next booster clinic date (vaccine sends only)
    const nextBooster = !isBooster ? await getNextBoosterClinic(eventDate) : null;

    const clinicDate = new Date(eventDate + 'T12:00:00');

    let sent = 0, skipped = 0;
    const previewVariants = preview ? new Map() : null; // key: sorted trigger ids -> { html, subject, triggerNames, sampleClient }

    for (const client of clients) {
      if (!client.email) { skipped++; continue; }

      const firstName  = (client.name || 'there').split(' ')[0];
      const clientPets = petsByClient[client.id] || [];
      const dueDates   = buildDueDates(clientPets, Array.isArray(vaccinations) ? vaccinations : []);
      // Only counts as "upcoming due" if the pet's next due date falls on or before
      // the next scheduled booster clinic — not just any future date.
      const boosterCutoff = nextBooster?.date || null;
      const hasUpcomingDue = boosterCutoff
        ? clientPets.some(p =>
            (Array.isArray(vaccinations) ? vaccinations : []).some(
              v => v.pet_id === p.id && v.next_due && v.next_due > today && v.next_due <= boosterCutoff
            )
          )
        : false;

      // Build chip_links for any trigger templates that need {{chip_links}}
      const chipLinks = clientPets
        .filter(p => p.microchip_number)
        .map(p =>
          `<li><strong>${p.name}:</strong> <a href="https://nano.fitracking.com/register/chip?id=${p.microchip_number}&petId=" style="color:#1a3a8f;">Register chip ${p.microchip_number}</a></li>`
        ).join('');

      const baseVars = {
        owner_name:             firstName,
        clinic_date:            clinicDate.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }),
        clinic_date_es:         clinicDate.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' }),
        reaction_doc_en:        `<a href="${REACTION_DOC_EN}" style="color:#1a3a8f;">Vaccine Take-Home Information (English)</a>`,
        reaction_doc_es:        `<a href="${REACTION_DOC_ES}" style="color:#1a3a8f;">Información sobre Vacunas (Español)</a>`,
        pet_due_dates_en:       dueDates.en,
        pet_due_dates_es:       dueDates.es,
        next_booster_clinic:    nextBooster ? nextBooster.en : 'TBD — stay tuned for announcements',
        next_booster_clinic_es: nextBooster ? nextBooster.es : 'por anunciar — estén atentos',
        website_link:           `<a href="${WEBSITE_LINK}" style="color:#1a3a8f;">peoplehelpingpets.org</a>`,
        snip_link:              `<a href="${SNIP_LINK}" style="color:#1a3a8f;">View the resource list (PDF)</a>`,
        lowcost_link:           `<a href="${LOWCOST_LINK}" style="color:#1a3a8f;">View the resource list (PDF)</a>`,
        chip_links:             chipLinks,
      };

      // Evaluate each trigger and build conditional blocks
      let extraBlocksEn = '';
      let extraBlocksEs = '';

      for (const trigger of triggers) {
        if (!evaluateConditions(trigger.conditions, client, clientPets, clinicType, hasUpcomingDue)) continue;

        const tplEn = triggerTemplates[trigger.template_en];
        const tplEs = triggerTemplates[trigger.template_es];
        const isChipTrigger = trigger.conditions?.has_microchip === true;
        const block = buildTriggerBlock(tplEn, tplEs, baseVars, isChipTrigger);
        extraBlocksEn += block.en;
        extraBlocksEs += block.es;
      }

      // Build main email body
      const enHeading = fill(tpl[`${prefix}_en`]?.subject, baseVars);
      const enBody    = fill(tpl[`${prefix}_en`]?.body,    baseVars);
      const esHeading = fill(tpl[`${prefix}_es`]?.subject, baseVars);
      const esBody    = fill(tpl[`${prefix}_es`]?.body,    baseVars);
      const subject   = fill(tpl[`${prefix}_subject`]?.subject, baseVars);

      const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;color:#1a1a2e;">
  <img src="https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/php-logo.png"
       alt="People Helping Pets" style="height:60px;margin-bottom:1.5rem;" />

  <h2 style="color:#1a3a8f;">${enHeading}</h2>
  <p style="white-space:pre-line;">${enBody}</p>
  ${extraBlocksEn}

  <hr style="border:none;border-top:2px solid #dce6f9;margin:1.5rem 0;">

  <h2 style="color:#1a3a8f;">${esHeading}</h2>
  <p style="white-space:pre-line;">${esBody}</p>
  ${extraBlocksEs}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;">
  <p style="font-size:12px;color:#888;">
    People Helping Pets · Chicago, IL ·
    <a href="${WEBSITE_LINK}" style="color:#888;">peoplehelpingpets.org</a>
  </p>
</body>
</html>`;

      if (preview) {
        const firedTriggerIds = triggers
          .filter(t => evaluateConditions(t.conditions, client, clientPets, clinicType, hasUpcomingDue))
          .map(t => t.id)
          .sort();
        const variantKey = firedTriggerIds.join(',') || '__none__';

        if (!previewVariants.has(variantKey)) {
          previewVariants.set(variantKey, {
            triggerIds:   firedTriggerIds,
            triggerNames: triggers.filter(t => firedTriggerIds.includes(t.id)).map(t => t.name),
            sampleClient: client.name,
            recipientCount: 1,
            subject,
            html,
          });
        } else {
          previewVariants.get(variantKey).recipientCount++;
        }
        continue; // do not actually send in preview mode
      }

      await sendEmail(client.email, subject, html);
      sent++;
    }

    if (preview) {
      return res.status(200).json({
        ok: true,
        preview: true,
        totalRecipients: clients.filter(c => c.email).length,
        skipped: clients.filter(c => !c.email).length,
        variants: Array.from(previewVariants.values()),
      });
    }

    return res.status(200).json({ ok: true, sent, skipped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}