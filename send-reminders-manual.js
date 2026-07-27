import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY      = process.env.RESEND_API_KEY;
const FROM_EMAIL          = 'reminders@peoplehelpingpets.org';

function fillTemplate(str, vars) {
  return str.replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '');
}

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  return res.json();
}

async function sbPatch(path, body) {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  });
}

async function getTemplate(id) {
  const rows = await sbFetch(`email_templates?id=eq.${id}&select=subject,body`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getNextBoosterClinic(afterDate) {
  const records = await sbFetch(
    `events?clinic_type=eq.Booster Clinic&event_date=gte.${afterDate}&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || !records.length) return null;
  return new Date(records[0].event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { vaccinationId, type } = req.body;
  if (!vaccinationId || !['2w', '1w'].includes(type)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const templateKey = type === '2w' ? 'reminder_2w' : 'reminder_1w';
    const sentField   = type === '2w' ? 'reminder_2w_sent' : 'reminder_1w_sent';

    const vaxRows = await sbFetch(
      `vaccinations?id=eq.${vaccinationId}&select=id,vaccine_name,next_due,pets(name,clients(id,name,email))`
    );
    const vax = vaxRows?.[0];
    if (!vax) return res.status(404).json({ error: 'Vaccination not found' });

    const pet    = vax.pets;
    const client = pet?.clients;
    if (!client?.email) return res.status(400).json({ error: 'No email on file for this client' });

    const ownerName = client.name || 'there';
    const petName   = pet.name;
    const vaccine   = vax.vaccine_name;
    const dueDate   = new Date(vax.next_due).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const isBooster = vaccine.toLowerCase().includes('booster');
    const clinicDate = isBooster ? await getNextBoosterClinic(vax.next_due) : null;

    const clinicDateLine = isBooster
      ? (clinicDate
          ? ` We have a Booster Clinic scheduled on ${clinicDate} — we hope to see you there!`
          : ' Please keep an eye out for our upcoming Booster Clinic announcements.')
      : '';

    const vars = { owner_name: ownerName, pet_name: petName, vaccine, due_date: dueDate, clinic_date_line: clinicDateLine };

    const suffix = isBooster ? '_booster' : '';
    const enTpl  = await getTemplate(`${templateKey}_en${suffix}`);
    const esTpl  = await getTemplate(`${templateKey}_es${suffix}`);

    if (!enTpl || !esTpl) return res.status(500).json({ error: 'Templates not found in database' });

    const subject = `${fillTemplate(enTpl.subject, vars)} / ${fillTemplate(esTpl.subject, vars)}`;
    const body    = `${fillTemplate(enTpl.body, vars)}\n\n---\n\n${fillTemplate(esTpl.body, vars)}`;

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: client.email,
        subject,
        text: body,
        tags: [
          { name: 'client_id',       value: String(client.id) },
          { name: 'email_type',      value: `${templateKey}${suffix}` },
          { name: 'vaccination_id',  value: String(vaccinationId) },
        ],
      })
    });

    if (!sendRes.ok) {
      const errBody = await sendRes.json().catch(() => ({}));
      const errMsg  = errBody.message || `Resend error (${sendRes.status})`;

      // Log the failure so it surfaces in the Failures tab, and don't mark as sent.
      await fetch(`${SUPABASE_URL}/rest/v1/email_send_failures`, {
        method: 'POST',
        headers: {
          apikey:         SUPABASE_SERVICE_KEY,
          Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: client.id,
          email:     client.email,
          context:   `${templateKey}${suffix}`,
          error:     errMsg,
        })
      });

      return res.status(502).json({ error: errMsg });
    }

    await sbPatch(`vaccinations?id=eq.${vaccinationId}`, { [sentField]: true });

    return res.status(200).json({ ok: true });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}