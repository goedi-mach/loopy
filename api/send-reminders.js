import { timingSafeEqual } from 'node:crypto';
import { requireRole } from './_auth.js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const FROM_EMAIL           = 'reminders@peoplehelpingpets.org';

const WEBSITE_LINK = 'https://peoplehelpingpets.org';
const SNIP_LINK    = 'https://www.chicago.gov/content/dam/city/depts/cacc/PDFiles/CACC%20Resource%20List.pdf';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── SMALL HELPERS ─────────────────────────────────────────────
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function chicagoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Reminders go out for vaccinations due within a 3-day window around N weeks from today (Chicago).
function getDateWindow(weeksOut) {
  const today = chicagoToday();
  const center = weeksOut * 7;
  return { start: addDays(today, center - 1), end: addDays(today, center + 1) };
}

// True only when the request carries the cron secret (Vercel adds it automatically
// when a CRON_SECRET environment variable exists).
function isCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given    = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ─── SUPABASE HELPERS ──────────────────────────────────────────
const sbHeaders = {
  apikey:        SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

async function sbFetch(path) {
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Database error (${res.status})`);
  return data;
}

async function fetchByIds(table, column, ids, query) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    out.push(...await sbFetch(`${table}?${column}=in.(${chunk.join(',')})&${query}`));
  }
  return out;
}

// PATCH and return the rows that were actually changed ([] on any failure).
async function sbPatchRows(path, body) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'PATCH',
      headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// Atomically mark a reminder as "ours". Only one run can win this for a given row.
async function claim(vaxId, sentField) {
  const rows = await sbPatchRows(
    `vaccinations?id=eq.${encodeURIComponent(vaxId)}&${sentField}=eq.false`,
    { [sentField]: true }
  );
  return rows.length === 1;
}

async function unclaim(vaxIds, sentField) {
  for (let i = 0; i < vaxIds.length; i += 100) {
    const chunk = vaxIds.slice(i, i + 100);
    const rows = await sbPatchRows(`vaccinations?id=in.(${chunk.join(',')})`, { [sentField]: false });
    if (rows.length !== chunk.length) {
      console.error(`Could not release ${chunk.length - rows.length} reminder flag(s) after a failed send; use Reset Flags in the Sent Log.`);
    }
  }
}

async function logSendFailure(client, context, error) {
  await fetch(`${SUPABASE_URL}/rest/v1/email_send_failures`, {
    method: 'POST',
    headers: { ...sbHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: client.id, email: client.email, context, error }),
  }).catch(() => {});
}

// ─── TEMPLATE HELPERS ──────────────────────────────────────────
// HTML version: turns a literal "\n" into <br>.
function fill(str, vars) {
  return (str || '')
    .replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '')
    .replace(/\\n/g, '<br>');
}

// Plain-text version for subject lines.
function fillPlain(str, vars) {
  return (str || '')
    .replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '')
    .replace(/\\n/g, ' ')
    .replace(/[\r\n]+/g, ' ');
}

async function loadTriggers(event) {
  const rows = await sbFetch(
    `triggers?event=eq.${encodeURIComponent(event)}&active=eq.true&order=created_at.asc`
  );
  return Array.isArray(rows) ? rows : [];
}

// ─── CONDITION EVALUATOR ───────────────────────────────────────
// For reminders, clientPets is all non-archived pets belonging to the client.
function evaluateConditions(conditions, client, clientPets) {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  if ('has_intact_pet' in conditions && conditions.has_intact_pet === true) {
    const hasIntact = clientPets.some(p => p.altered === 'no' || p.altered === 'unknown');
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

// ─── SEND EMAIL (BATCH) ─────────────────────────────────────────
async function sendBatch(items) {
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(items.map(item => ({
      from:    FROM_EMAIL,
      to:      item.to,
      subject: item.subject,
      html:    item.html,
      tags:    item.tags,
    })))
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Resend batch error (${res.status})`);
  }

  const { data } = await res.json();
  return (data || []).map(d => d.id);
}

// ─── PROCESS REMINDERS ─────────────────────────────────────────
async function processReminders(weeksOut, sentField) {
  const { start, end } = getDateWindow(weeksOut);
  const templateKey    = weeksOut === 2 ? 'reminder_2w' : 'reminder_1w';
  const stats = { found: 0, queued: 0, sent: 0, failed: 0, skipped: 0, claimedElsewhere: 0, logFailures: 0 };

  // Vaccinations due in the window that haven't had this reminder yet.
  const records = await sbFetch(
    `vaccinations?select=id,vaccine_name,next_due,` +
    `pets(id,name,archived,clients(id,name,email,zip,preferred_language,archived))` +
    `&next_due=gte.${start}&next_due=lte.${end}&${sentField}=eq.false&order=id.asc&limit=1000`
  );
  stats.found = records.length;
  if (!records.length) return stats;

  // Per-run caches so we don't re-fetch the same thing for every record.
  const tplCache = new Map();
  async function getTpl(id) {
    if (!tplCache.has(id)) {
      const rows = await sbFetch(`email_templates?id=eq.${encodeURIComponent(id)}&select=id,subject,body`);
      tplCache.set(id, Array.isArray(rows) && rows[0] ? rows[0] : null);
    }
    return tplCache.get(id);
  }

  const clinicCache = new Map();
  async function getNextClinicDate(clinicType, afterDate) {
    const key = `${clinicType}|${afterDate}`;
    if (!clinicCache.has(key)) {
      const rows = await sbFetch(
        `events?clinic_type=eq.${encodeURIComponent(clinicType)}&event_date=gte.${afterDate}&completed=eq.false&order=event_date.asc&limit=1`
      );
      if (!Array.isArray(rows) || !rows.length) {
        clinicCache.set(key, null);
      } else {
        const date = new Date(rows[0].event_date + 'T12:00:00');
        clinicCache.set(key, {
          en: date.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }),
          es: date.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' }),
        });
      }
    }
    return clinicCache.get(key);
  }

  // Triggers for this reminder type, and their templates.
  const triggers = await loadTriggers(templateKey);
  await Promise.all(triggers.flatMap(t => [getTpl(t.template_en), getTpl(t.template_es)]));

  // All pets for the clients involved, in one go (for trigger conditions).
  const clientIds = [...new Set(records.map(v => v.pets?.clients?.id).filter(Boolean))];
  const allPets = clientIds.length
    ? await fetchByIds('pets', 'client_id', clientIds,
        'archived=eq.false&select=id,client_id,altered,microchip_number&limit=5000')
    : [];
  const petsByClient = {};
  allPets.forEach(p => { (petsByClient[p.client_id] ||= []).push(p); });

  const sendQueue = [];

  for (const vax of records) {
    const pet    = vax.pets;
    const client = pet?.clients;
    if (!pet || !client || pet.archived || client.archived) { stats.skipped++; continue; }
    if (!client.email || !EMAIL_RE.test(client.email.trim())) { stats.skipped++; continue; }

    const rawOwner = (client.name || 'there').split(' ')[0];
    const rawPet   = pet.name || 'your pet';
    const vaccine  = vax.vaccine_name || 'vaccine';
    const dueDate  = new Date(vax.next_due + 'T12:00:00')
      .toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

    const isBooster     = vaccine.toLowerCase().includes('booster');
    const clinicType    = isBooster ? 'Booster Clinic' : 'Vaccine Clinic';
    const clinicLabelEn = isBooster ? 'Booster Clinic' : 'Vaccine Clinic';
    const clinicLabelEs = isBooster ? 'Clínica de Refuerzo' : 'Clínica de Vacunas';
    const nextClinic    = await getNextClinicDate(clinicType, vax.next_due);

    const clinic_date_line_en = nextClinic
      ? ` We have a ${clinicLabelEn} scheduled on ${nextClinic.en} — we hope to see you there!`
      : ` Please keep an eye out for our upcoming ${clinicLabelEn} announcements.`;
    const clinic_date_line_es = nextClinic
      ? ` Tenemos una ${clinicLabelEs} programada el ${nextClinic.es} — ¡esperamos verlos!`
      : ` Estén atentos a los anuncios de nuestra próxima ${clinicLabelEs}.`;

    // HTML version (user-supplied values escaped).
    const htmlVars = {
      owner_name:  esc(rawOwner),
      pet_name:    esc(rawPet),
      vaccine:     esc(vaccine),
      due_date:    dueDate,
      clinic_date_line_en,
      clinic_date_line_es,
      snip_link:    `<a href="${SNIP_LINK}" style="color:#1a3a8f;">View the resource list (PDF)</a>`,
      website_link: `<a href="${WEBSITE_LINK}" style="color:#1a3a8f;">peoplehelpingpets.org</a>`,
      chip_links:   '',  // not applicable for reminders
    };
    // Plain-text version for the subject line.
    const textVars = {
      owner_name: rawOwner,
      pet_name:   rawPet,
      vaccine,
      due_date:   dueDate,
      clinic_date_line_en,
      clinic_date_line_es,
      snip_link:    SNIP_LINK,
      website_link: WEBSITE_LINK,
      chip_links:   '',
    };

    const suffix = isBooster ? '_booster' : '';
    const enTpl  = await getTpl(`${templateKey}_en${suffix}`);
    const esTpl  = await getTpl(`${templateKey}_es${suffix}`);
    if (!enTpl || !esTpl) {
      console.warn(`Missing template for ${templateKey}${suffix}, skipping`);
      stats.skipped++;
      continue;
    }

    const clientPets = petsByClient[client.id] || [];

    let extraBlocksEn = '';
    let extraBlocksEs = '';
    for (const trigger of triggers) {
      if (!evaluateConditions(trigger.conditions, client, clientPets)) continue;
      const block = buildTriggerBlock(
        tplCache.get(trigger.template_en),
        tplCache.get(trigger.template_es),
        htmlVars,
        trigger.conditions?.has_microchip === true
      );
      extraBlocksEn += block.en;
      extraBlocksEs += block.es;
    }

    const subject = `${fillPlain(enTpl.subject, textVars)} / ${fillPlain(esTpl.subject, textVars)}`;

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;color:#1a1a2e;">
  <img src="https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/php-logo.png"
       alt="People Helping Pets" style="height:60px;margin-bottom:1.5rem;" />

  <p style="white-space:pre-line;">${fill(enTpl.body, htmlVars)}</p>
  ${extraBlocksEn}

  <hr style="border:none;border-top:2px solid #dce6f9;margin:1.5rem 0;">

  <p style="white-space:pre-line;">${fill(esTpl.body, htmlVars)}</p>
  ${extraBlocksEs}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;">
  <p style="font-size:12px;color:#888;">
    People Helping Pets · Chicago, IL ·
    <a href="${WEBSITE_LINK}" style="color:#888;">peoplehelpingpets.org</a>
  </p>
</body>
</html>`;

    sendQueue.push({
      client, vaxId: vax.id, subject, html,
      tags: [
        { name: 'client_id',      value: String(client.id) },
        { name: 'email_type',     value: `${templateKey}${suffix}` },
        { name: 'vaccination_id', value: String(vax.id) },
      ],
    });
  }
  stats.queued = sendQueue.length;

  // ── BATCH SEND ──────────────────────────────────────────────
  const BATCH_CHUNK = 100; // Resend's per-call max
  for (let i = 0; i < sendQueue.length; i += BATCH_CHUNK) {
    const chunk = sendQueue.slice(i, i + BATCH_CHUNK);

    // Claim first: only reminders we actually flipped from "not sent" to "sent" are ours to email.
    // A second overlapping run loses the claim and sends nothing, so nobody is emailed twice.
    const claims = await Promise.all(chunk.map(item => claim(item.vaxId, sentField)));
    const mine = chunk.filter((_, idx) => claims[idx]);
    stats.claimedElsewhere += chunk.length - mine.length;
    if (!mine.length) continue;

    try {
      const resendIds = await sendBatch(mine.map(item => ({
        to:      item.client.email.trim(),
        subject: item.subject,
        html:    item.html,
        tags:    item.tags,
      })));
      stats.sent += mine.length;

      const logged = await Promise.all(mine.map((item, idx) =>
        fetch(`${SUPABASE_URL}/rest/v1/reminder_email_log`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
          body: JSON.stringify({
            vaccination_id:  item.vaxId,
            reminder_type:   weeksOut === 2 ? '2w' : '1w',
            resend_email_id: resendIds[idx] || null,
          })
        }).then(r => r.ok).catch(() => false)
      ));
      stats.logFailures += logged.filter(ok => !ok).length;
    } catch (batchErr) {
      console.error(`Batch send failed for ${mine.length} reminder(s): ${batchErr.message}`);
      stats.failed += mine.length;
      // Hand the reminders back so tomorrow's run retries them, and show the failure in the app.
      await unclaim(mine.map(item => item.vaxId), sentField);
      await Promise.all(mine.map(item => logSendFailure(item.client, templateKey, batchErr.message)));
    }
  }

  return stats;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allowed: the scheduler (with CRON_SECRET) or a signed-in admin running it by hand.
  if (!isCron(req)) {
    const caller = await requireRole(req, res, ['admin']);
    if (!caller) return;
  }

  const results = {};
  const errors  = [];
  for (const [name, weeks, field] of [
    ['twoWeek', 2, 'reminder_2w_sent'],
    ['oneWeek', 1, 'reminder_1w_sent'],
  ]) {
    try {
      results[name] = await processReminders(weeks, field);
    } catch (e) {
      console.error(`[${name}] ${e.message}`);
      errors.push(`${name}: ${e.message}`);
      results[name] = null;
    }
  }

  console.log(JSON.stringify({ job: 'send-reminders', results, errors }));

  if (errors.length) return res.status(500).json({ ok: false, errors, results });
  return res.status(200).json({ ok: true, results });
}