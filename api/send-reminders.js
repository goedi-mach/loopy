const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const FROM_EMAIL           = 'reminders@peoplehelpingpets.org';

const WEBSITE_LINK = 'https://peoplehelpingpets.org';
const SNIP_LINK    = 'https://www.chicago.gov/content/dam/city/depts/cacc/PDFiles/CACC%20Resource%20List.pdf';

// ─── SUPABASE HELPERS ──────────────────────────────────────────
async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  return res.json();
}

async function sbPatch(path, body) {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal'
    },
    body: JSON.stringify(body)
  });
}

// ─── TEMPLATE HELPERS ──────────────────────────────────────────
async function getTemplate(id) {
  const rows = await sbFetch(`email_templates?id=eq.${id}&select=subject,body`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

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

async function loadTemplate(id) {
  const rows = await sbFetch(`email_templates?id=eq.${id}&select=id,subject,body`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// ─── CONDITION EVALUATOR ───────────────────────────────────────
// For reminders, clientPets is all non-archived pets belonging to the client.
// "has_microchip" and "has_intact_pet" are evaluated across ALL their pets,
// not just the one whose vaccination triggered this reminder.
function evaluateConditions(conditions, client, clientPets) {
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

  if ('zip' in conditions && Array.isArray(conditions.zip)) {
    const clientZip = (client.zip || '').trim();
    if (!conditions.zip.includes(clientZip)) return false;
  }

  if ('preferred_language' in conditions) {
    if (conditions.preferred_language !== client.preferred_language) return false;
  }

  return true;
}

// ─── BUILD TRIGGER BLOCK HTML ──────────────────────────────────
function buildTriggerBlock(tplEn, tplEs, vars) {
  if (!tplEn && !tplEs) return { en: '', es: '' };
  const en = tplEn ? `
    <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
    <p><strong>${fill(tplEn.subject, vars)}</strong></p>
    <p>${fill(tplEn.body, vars)}</p>` : '';
  const es = tplEs ? `
    <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
    <p><strong>${fill(tplEs.subject, vars)}</strong></p>
    <p>${fill(tplEs.body, vars)}</p>` : '';
  return { en, es };
}

// ─── NEXT CLINIC DATE ──────────────────────────────────────────
async function getNextClinicDate(clinicType, afterDate) {
  const records = await sbFetch(
    `events?notes=eq.${encodeURIComponent(clinicType)}&event_date=gte.${afterDate}&completed=eq.false&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || !records.length) return null;
  const date = new Date(records[0].event_date + 'T12:00:00');
  return {
    en: date.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }),
    es: date.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' })
  };
}

// ─── DATE WINDOW ───────────────────────────────────────────────
function getDateWindow(weeksOut) {
  const start = new Date();
  start.setDate(start.getDate() + (weeksOut * 7) - 1);
  const end = new Date();
  end.setDate(end.getDate() + (weeksOut * 7) + 1);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0]
  };
}

// ─── SEND EMAIL (HTML) ─────────────────────────────────────────
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

// ─── PROCESS REMINDERS ─────────────────────────────────────────
async function processReminders(weeksOut, sentField) {
  const { start, end } = getDateWindow(weeksOut);
  const templateKey    = weeksOut === 2 ? 'reminder_2w' : 'reminder_1w';
  const triggerEvent   = weeksOut === 2 ? 'reminder_2w' : 'reminder_1w';

  // Pull vaccinations due in the window, joining through pets → clients
  // Also pull client zip and preferred_language for trigger evaluation
  const records = await sbFetch(
    `vaccinations?select=id,vaccine_name,next_due,${sentField},` +
    `pets(id,name,altered,microchip_number,clients(id,name,email,zip,preferred_language))` +
    `&next_due=gte.${start}&next_due=lte.${end}&${sentField}=eq.false`
  );

  console.log(`[${templateKey}] Raw response:`, JSON.stringify(records));
  if (!Array.isArray(records)) {
    console.error(`[${templateKey}] Expected array, got:`, typeof records, records);
    return;
  }
  console.log(`[${templateKey}] Found ${records.length} reminders to send`);

  // Load triggers for this event type (once, not per record)
  const triggers = await loadTriggers(triggerEvent);

  // Pre-load all trigger templates in parallel
  const triggerTemplates = {};
  await Promise.all(triggers.flatMap(t => [
    loadTemplate(t.template_en).then(r => { triggerTemplates[t.template_en] = r; }),
    loadTemplate(t.template_es).then(r => { triggerTemplates[t.template_es] = r; }),
  ]));

  for (const vax of records) {
    const pet    = vax.pets;
    const client = pet?.clients;
    if (!client?.email) continue;

    const ownerName = (client.name || 'there').split(' ')[0];
    const petName   = pet.name;
    const vaccine   = vax.vaccine_name;
    const dueDate   = new Date(vax.next_due + 'T12:00:00')
      .toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

    const isBooster       = vaccine.toLowerCase().includes('booster');
    const clinicType      = isBooster ? 'Booster Clinic' : 'Vaccine Clinic';
    const clinicLabelEn   = isBooster ? 'Booster Clinic' : 'Vaccine Clinic';
    const clinicLabelEs   = isBooster ? 'Clínica de Refuerzo' : 'Clínica de Vacunas';
    const nextClinic      = await getNextClinicDate(clinicType, vax.next_due);

    const clinic_date_line_en = nextClinic
      ? ` We have a ${clinicLabelEn} scheduled on ${nextClinic.en} — we hope to see you there!`
      : ` Please keep an eye out for our upcoming ${clinicLabelEn} announcements.`;
    const clinic_date_line_es = nextClinic
      ? ` Tenemos una ${clinicLabelEs} programada el ${nextClinic.es} — ¡esperamos verlos!`
      : ` Estén atentos a los anuncios de nuestra próxima ${clinicLabelEs}.`;

    const baseVars = {
      owner_name:           ownerName,
      pet_name:             petName,
      vaccine,
      due_date:             dueDate,
      clinic_date_line_en,
      clinic_date_line_es,
      snip_link:            `<a href="${SNIP_LINK}" style="color:#1a3a8f;">View the resource list (PDF)</a>`,
      website_link:         `<a href="${WEBSITE_LINK}" style="color:#1a3a8f;">peoplehelpingpets.org</a>`,
      chip_links:           '',  // not applicable for reminders
    };

    // Load main EN/ES reminder templates
    const suffix = isBooster ? '_booster' : '';
    const enTpl  = await getTemplate(`${templateKey}_en${suffix}`);
    const esTpl  = await getTemplate(`${templateKey}_es${suffix}`);
    if (!enTpl || !esTpl) {
      console.warn(`Missing template for ${templateKey}${suffix}, skipping`);
      continue;
    }

    // Fetch all of this client's pets for trigger condition evaluation
    const clientPets = await sbFetch(
      `pets?client_id=eq.${client.id}&archived=eq.false&select=id,altered,microchip_number&limit=100`
    );

    // Evaluate triggers and build extra blocks
    let extraBlocksEn = '';
    let extraBlocksEs = '';
    for (const trigger of triggers) {
      // Skip clinic_type-scoped triggers that don't match this reminder's vaccine type
      if ('clinic_type' in trigger.conditions && trigger.conditions.clinic_type !== clinicType) continue;

      if (!evaluateConditions(trigger.conditions, client, Array.isArray(clientPets) ? clientPets : [])) continue;

      const tplEn = triggerTemplates[trigger.template_en];
      const tplEs = triggerTemplates[trigger.template_es];
      const block = buildTriggerBlock(tplEn, tplEs, baseVars);
      extraBlocksEn += block.en;
      extraBlocksEs += block.es;
    }

    const subject = `${fill(enTpl.subject, baseVars)} / ${fill(esTpl.subject, baseVars)}`;

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;color:#1a1a2e;">
  <img src="https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/php-logo.png"
       alt="People Helping Pets" style="height:60px;margin-bottom:1.5rem;" />

  <p style="white-space:pre-line;">${fill(enTpl.body, baseVars)}</p>
  ${extraBlocksEn}

  <hr style="border:none;border-top:2px solid #dce6f9;margin:1.5rem 0;">

  <p style="white-space:pre-line;">${fill(esTpl.body, baseVars)}</p>
  ${extraBlocksEs}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;">
  <p style="font-size:12px;color:#888;">
    People Helping Pets · Chicago, IL ·
    <a href="${WEBSITE_LINK}" style="color:#888;">peoplehelpingpets.org</a>
  </p>
</body>
</html>`;

    await sendEmail(client.email, subject, html);
    await sbPatch(`vaccinations?id=eq.${vax.id}`, { [sentField]: true });

    console.log(`Sent ${templateKey} for pet "${petName}" to ${client.email}`);
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    await processReminders(2, 'reminder_2w_sent');
    await processReminders(1, 'reminder_1w_sent');
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}