import { requireRole } from './_auth.js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const FROM_EMAIL           = 'reminders@peoplehelpingpets.org';

const ID_RE    = /^[\w-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fillTemplate(str, vars) {
  return (str || '').replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '');
}

function fmtDate(isoDate) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Database error (${res.status})`);
  return data;
}

// Returns true only if exactly the expected row was updated.
async function sbPatchOne(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length === 1;
}

async function getTemplate(id) {
  const rows = await sbFetch(`email_templates?id=eq.${encodeURIComponent(id)}&select=subject,body`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getNextBoosterClinic(afterDate) {
  const records = await sbFetch(
    `events?clinic_type=eq.Booster%20Clinic&completed=eq.false&event_date=gte.${afterDate}&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || !records.length) return null;
  return fmtDate(records[0].event_date);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Only signed-in staff/admin may send reminders.
  const caller = await requireRole(req, res, ['staff', 'admin']);
  if (!caller) return;

  const { vaccinationId, type } = req.body || {};
  if (typeof vaccinationId !== 'string' && typeof vaccinationId !== 'number') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const vaxId = String(vaccinationId);
  if (!ID_RE.test(vaxId) || !['2w', '1w'].includes(type)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const templateKey = type === '2w' ? 'reminder_2w' : 'reminder_1w';
    const sentField   = type === '2w' ? 'reminder_2w_sent' : 'reminder_1w_sent';

    const vaxRows = await sbFetch(
      `vaccinations?id=eq.${encodeURIComponent(vaxId)}` +
      `&select=id,vaccine_name,next_due,pets(name,archived,clients(id,name,email,archived))`
    );
    const vax = vaxRows?.[0];
    if (!vax) return res.status(404).json({ error: 'Vaccination not found' });

    const pet    = vax.pets;
    const client = pet?.clients;
    if (!pet || !client) return res.status(400).json({ error: 'This record is missing its pet or client' });
    if (pet.archived || client.archived) {
      return res.status(400).json({ error: 'This pet or client is archived, so no reminder was sent' });
    }
    if (!client.email || !EMAIL_RE.test(client.email.trim())) {
      return res.status(400).json({ error: 'No valid email on file for this client' });
    }
    if (!vax.next_due) {
      return res.status(400).json({ error: 'This vaccination has no due date' });
    }

    const ownerName = client.name || 'there';
    const petName   = pet.name || 'your pet';
    const vaccine   = vax.vaccine_name || 'vaccine';
    const dueDate   = fmtDate(vax.next_due);
    const isBooster = vaccine.toLowerCase().includes('booster');
    const clinicDate = isBooster ? await getNextBoosterClinic(vax.next_due) : null;

    const clinicDateLine = isBooster
      ? (clinicDate
          ? ` We have a Booster Clinic scheduled on ${clinicDate} — we hope to see you there!`
          : ' Please keep an eye out for our upcoming Booster Clinic announcements.')
      : '';

    const vars = { owner_name: ownerName, pet_name: petName, vaccine, due_date: dueDate, clinic_date_line: clinicDateLine };

    const suffix = isBooster ? '_booster' : '';
    const [enTpl, esTpl] = await Promise.all([
      getTemplate(`${templateKey}_en${suffix}`),
      getTemplate(`${templateKey}_es${suffix}`),
    ]);

    if (!enTpl || !esTpl) return res.status(500).json({ error: 'Templates not found in database' });

    const subject = `${fillTemplate(enTpl.subject, vars)} / ${fillTemplate(esTpl.subject, vars)}`
      .replace(/[\r\n]+/g, ' ');
    const body    = `${fillTemplate(enTpl.body, vars)}\n\n---\n\n${fillTemplate(esTpl.body, vars)}`;

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: client.email.trim(),
        subject,
        text: body,
        tags: [
          { name: 'client_id',       value: String(client.id) },
          { name: 'email_type',      value: `${templateKey}${suffix}` },
          { name: 'vaccination_id',  value: vaxId },
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
      }).catch(() => {});

      return res.status(502).json({ error: errMsg });
    }

    // The email is out. If we can't record that, say so loudly: the nightly job
    // would otherwise send this same reminder again.
    const flagged = await sbPatchOne(`vaccinations?id=eq.${encodeURIComponent(vaxId)}`, { [sentField]: true });
    if (!flagged) {
      console.error(`Reminder sent but ${sentField} could not be set on vaccination ${vaxId}`);
      return res.status(200).json({
        ok: true,
        warning: 'The email was sent, but the record could not be marked as sent. The nightly job may send it again. Check this vaccination in the Sent Log.'
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}