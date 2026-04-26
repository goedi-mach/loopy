const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'reminders@peoplehelpingpets.org';

const templates = {
  reminder_2w: {
    en: (ownerName, petName, vaccine, dueDate, isBooster, clinicDate) => ({
      subject: `Vaccine reminder for ${petName} from People Helping Pets`,
      body: isBooster
        ? `Hi ${ownerName},\n\nThis is a reminder that ${petName} is due for their ${vaccine} around ${dueDate}.${clinicDate ? ` We have a Booster Clinic scheduled on ${clinicDate} — we hope to see you there!` : ' Please keep an eye out for our upcoming Booster Clinic announcements.'}\n\nThank you,\nPeople Helping Pets`
        : `Hi ${ownerName},\n\nThis is a friendly reminder that ${petName} is due for their ${vaccine} vaccine around ${dueDate}. Please visit our website and check out our upcoming clinics (https://peoplehelpingpets.org/events/). We hope to see you soon!\n\nThank you,\nPeople Helping Pets`
    }),
    es: (ownerName, petName, vaccine, dueDate, isBooster, clinicDate) => ({
      subject: `Recordatorio de vacuna para ${petName} — People Helping Pets`,
      body: isBooster
        ? `Hola ${ownerName},\n\nLe recordamos que ${petName} tiene pendiente su vacuna de ${vaccine} alrededor del ${dueDate}.${clinicDate ? ` Tenemos una Clínica de Refuerzo programada el ${clinicDate} — ¡esperamos verlos allí!` : ' Estén atentos a nuestros próximos anuncios de Clínica de Refuerzo.'}\n\nGracias,\nPeople Helping Pets`
        : `Hola ${ownerName},\n\nLe recordamos que ${petName} tiene pendiente su vacuna de ${vaccine} alrededor del ${dueDate}. Porfavor visita nuestra página web y consulta nuestras próximas clínicas (https://peoplehelpingpets.org/events/). Esperamos verlos pronto!\n\nGracias,\nPeople Helping Pets`
    })
  },
  reminder_1w: {
    en: (ownerName, petName, vaccine, dueDate, isBooster, clinicDate) => ({
      subject: `Upcoming vaccine for ${petName} from People Helping Pets`,
      body: isBooster
        ? `Hi ${ownerName},\n\n${petName}'s ${vaccine} is coming up around ${dueDate} — just one week away!${clinicDate ? ` Our Booster Clinic is scheduled on ${clinicDate} — we hope to see you there!` : ' Please keep an eye out for our upcoming Booster Clinic announcements.'}\n\nThank you,\nPeople Helping Pets`
        : `Hi ${ownerName},\n\n${petName}'s ${vaccine} vaccine is coming up around ${dueDate} — just one week away! We hope to see you soon at a People Helping Pets clinic.\n\nThank you,\nPeople Helping Pets`
    }),
    es: (ownerName, petName, vaccine, dueDate, isBooster, clinicDate) => ({
      subject: `Vacuna próxima para ${petName} — People Helping Pets`,
      body: isBooster
        ? `Hola ${ownerName},\n\nLa vacuna de ${vaccine} para ${petName} está próxima, alrededor del ${dueDate} — ¡solo falta una semana!${clinicDate ? ` Nuestra Clínica de Refuerzo está programada el ${clinicDate} — ¡esperamos verlos allí!` : ' Estén atentos a nuestros próximos anuncios de Clínica de Refuerzo.'}\n\nGracias,\nPeople Helping Pets`
        : `Hola ${ownerName},\n\nLa vacuna de ${vaccine} para ${petName} está próxima, alrededor del ${dueDate} — ¡solo falta una semana! Esperamos verlos pronto en una clínica de People Helping Pets.\n\nGracias,\nPeople Helping Pets`
    })
  }
};

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
async function getNextBoosterClinic(afterDate) {
  const records = await sbFetch(
    `events?clinic_type=eq.Booster Clinic&event_date=gte.${afterDate}&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || records.length === 0) return null;
  return new Date(records[0].event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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
    const dueDate = new Date(vax.next_due).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const isBooster = vaccine.toLowerCase().includes('booster');
    const boosterClinicDate = isBooster ? await getNextBoosterClinic(vax.next_due) : null;

    // Send bilingual — one email with both languages
    const en = templates[templateKey].en(ownerName, petName, vaccine, dueDate, isBooster, boosterClinicDate);
    const es = templates[templateKey].es(ownerName, petName, vaccine, dueDate, isBooster, boosterClinicDate);

    const subject = `${en.subject} / ${es.subject}`;
    const body = `${en.body}\n\n---\n\n${es.body}`;

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