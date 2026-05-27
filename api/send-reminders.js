const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'reminders@peoplehelpingpets.org';

async function getTemplate(id) {
  const rows = await sbFetch(`email_templates?id=eq.${id}&select=subject,body`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function fillTemplate(str, vars) {
  return str.replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '');
}

function getDateWindow(weeksOut) {
  const start = new Date();
  start.setDate(start.getDate() + (weeksOut * 7) - 1);
  const end = new Date();
  end.setDate(end.getDate() + (weeksOut * 7) + 1);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
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

async function sendEmail(to, subject, body) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      text: body
    })
  });
}
async function getNextClinicDate(clinicType, afterDate) {
  const records = await sbFetch(
    `events?clinic_type=eq.${encodeURIComponent(clinicType)}&event_date=gte.${afterDate}&completed=eq.false&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || records.length === 0) return null;
  const date = new Date(records[0].event_date + 'T12:00:00');
  return {
    en: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    es: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  };
}
async function processReminders(weeksOut, sentField) {
  const { start, end } = getDateWindow(weeksOut);
  const templateKey = weeksOut === 2 ? 'reminder_2w' : 'reminder_1w';

  const records = await sbFetch(
    `vaccinations?select=id,vaccine_name,next_due,${sentField},pets(name,clients(name,email))` +
    `&next_due=gte.${start}&next_due=lte.${end}&${sentField}=eq.false`
  );

  console.log(`[${templateKey}] Raw response:`, JSON.stringify(records));
  if (!Array.isArray(records)) {
    console.error(`[${templateKey}] Expected array, got:`, typeof records, records);
    return;
  }
  console.log(`[${templateKey}] Found ${records.length} reminders to send`);

  for (const vax of records) {
    const pet = vax.pets;
    const client = pet?.clients;
    if (!client?.email) continue;

    const ownerName = client.name || 'there';
    const petName = pet.name;
    const vaccine = vax.vaccine_name;
    const dueDate = new Date(vax.next_due + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

   const isBooster = vaccine.toLowerCase().includes('booster');
    const relevantClinicType = isBooster ? 'Booster Clinic' : 'Vaccine Clinic';
    const nextClinic = await getNextClinicDate(relevantClinicType, vax.next_due);
    const clinicLabel = isBooster ? 'Booster Clinic' : 'Vaccine Clinic';
    const clinicLabelEs = isBooster ? 'Clínica de Refuerzo' : 'Clínica de Vacunas';
    const clinic_date_line_en = nextClinic
      ? ` We have a ${clinicLabel} scheduled on ${nextClinic.en} — we hope to see you there!`
      : ` Please keep an eye out for our upcoming ${clinicLabel} announcements.`;
    const clinic_date_line_es = nextClinic
      ? ` Tenemos una ${clinicLabelEs} programada el ${nextClinic.es} — ¡esperamos verlos!`
      : ` Estén atentos a los anuncios de nuestra próxima ${clinicLabelEs}.`;
    const vars = { owner_name: ownerName, pet_name: petName, vaccine, due_date: dueDate, clinic_date_line_en, clinic_date_line_es };
    const suffix = isBooster ? '_booster' : '';
    const enTpl  = await getTemplate(`${templateKey}_en${suffix}`);
    const esTpl  = await getTemplate(`${templateKey}_es${suffix}`);

    const subject = `${fillTemplate(enTpl.subject, vars)} / ${fillTemplate(esTpl.subject, vars)}`;
    const body    = `${fillTemplate(enTpl.body, vars)}\n\n---\n\n${fillTemplate(esTpl.body, vars)}`;

    await sendEmail(client.email, subject, body);
    await sbPatch(`vaccinations?id=eq.${vax.id}`, { [sentField]: true });

    console.log(`Sent ${templateKey} for pet "${petName}" to ${client.email}`);
  }
}

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