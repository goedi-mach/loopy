const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const FROM_EMAIL           = 'reminders@peoplehelpingpets.org';

const REACTION_DOC_EN = 'https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/VaccineTakeHome_ENG.pdf';
const REACTION_DOC_ES = 'https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/VacunasHojaInfo_ESP.pdf';

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  return res.json();
}

async function getNextClinic(afterDate) {
  const records = await sbFetch(
    `events?completed=eq.false&event_date=gt.${afterDate}&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || !records.length) return null;
  const e    = records[0];
  const date = new Date(e.event_date + 'T12:00:00');
  return {
    date_en:    date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    date_es:    date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    location:   e.location || '',
    clinic_type:    e.clinic_type || 'Clinic',
    clinic_type_es: e.clinic_type === 'Booster Clinic' ? 'Clínica de Refuerzo' : 'Clínica de Vacunas',
  };
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { eventDate, clinicType } = req.body;
  if (!eventDate) return res.status(400).json({ error: 'eventDate is required' });

  try {
    // Pull all non-archived clients for this event date
    const clients = await sbFetch(
      `clients?event_date=eq.${eventDate}&archived=eq.false&select=id,name,email&limit=5000`
    );

    // Pull pets for these clients to check snip_interest
    const clientIds = clients.map(c => c.id);
    const snipSet   = new Set();
    if (clientIds.length) {
      const pets = await sbFetch(
        `pets?client_id=in.(${clientIds.join(',')})&snip_interest=eq.true&select=client_id&limit=5000`
      );
      pets.forEach(p => snipSet.add(p.client_id));
    }

    // Get next upcoming clinic
    const nextClinic = await getNextClinic(eventDate);

    const clinicTypeEs = clinicType === 'Booster Clinic' ? 'Clínica de Refuerzo' : 'Clínica de Vacunas';

    let sent = 0, skipped = 0;

    for (const client of clients) {
      if (!client.email) { skipped++; continue; }

      const firstName = (client.name || 'there').split(' ')[0];
      const hasSnipInterest = snipSet.has(client.id);

      // Next clinic block
      const nextClinicBlockEn = nextClinic
        ? `<p>📅 <strong>Our next clinic:</strong> ${nextClinic.clinic_type} on ${nextClinic.date_en} at ${nextClinic.location}. We hope to see you there!</p>`
        : `<p>📅 Keep an eye out for announcements about our upcoming clinics!</p>`;

      const nextClinicBlockEs = nextClinic
        ? `<p>📅 <strong>Nuestra próxima clínica:</strong> ${nextClinic.clinic_type_es} el ${nextClinic.date_es} en ${nextClinic.location}. ¡Esperamos verlos!</p>`
        : `<p>📅 ¡Estén atentos a los anuncios sobre nuestras próximas clínicas!</p>`;

      // Spay/neuter block (only if applicable)
      const snipBlockEn = hasSnipInterest
        ? `<hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
           <p>🐾 <strong>Interested in spay/neuter services?</strong> Chicago Animal Care and Control has a resource list of affordable spay/neuter providers in the city. <a href="https://www.chicago.gov/content/dam/city/depts/cacc/PDFiles/CACC%20Resource%20List.pdf" style="color:#1a3a8f;">View the resource list (PDF)</a>.</p>`
        : '';

      const snipBlockEs = hasSnipInterest
        ? `<hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
           <p>🐾 <strong>¿Interesado en servicios de esterilización?</strong> Chicago Animal Care and Control tiene una lista de proveedores de esterilización asequibles en la ciudad. <a href="https://www.chicago.gov/content/dam/city/depts/cacc/PDFiles/CACC%20Resource%20List.pdf" style="color:#1a3a8f;">Ver la lista de recursos (PDF)</a>.</p>`
        : '';

      const subject = `Thank you for visiting People Helping Pets! / ¡Gracias por visitar People Helping Pets!`;

      const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;color:#1a1a2e;">

  <img src="https://peoplehelpingpets.org/wp-content/uploads/2024/01/PHP-Logo.png"
       alt="People Helping Pets" style="height:60px;margin-bottom:1.5rem;" />

  <!-- ENGLISH -->
  <h2 style="color:#1a3a8f;">Thank you for visiting us, ${firstName}!</h2>
  <p>We're so glad you and your pet(s) came to our ${clinicType || 'clinic'} on ${new Date(eventDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
  <p>📄 Please review the attached vaccine reaction information sheet:<br>
     <a href="${REACTION_DOC_EN}" style="color:#1a3a8f;font-weight:bold;">Vaccine Take-Home Information (English)</a></p>
  ${nextClinicBlockEn}
  ${snipBlockEn}

  <hr style="margin:2rem 0;border:none;border-top:2px solid #dce6f9;">

  <!-- ESPAÑOL -->
  <h2 style="color:#1a3a8f;">¡Gracias por visitarnos, ${firstName}!</h2>
  <p>Nos alegra mucho que usted y su(s) mascota(s) hayan venido a nuestra ${clinicTypeEs} el ${new Date(eventDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
  <p>📄 Por favor revise la hoja informativa sobre reacciones a vacunas:<br>
     <a href="${REACTION_DOC_ES}" style="color:#1a3a8f;font-weight:bold;">Información sobre Vacunas (Español)</a></p>
  ${nextClinicBlockEs}
  ${snipBlockEs}

  <hr style="margin:2rem 0;border:none;border-top:1px solid #e5e7eb;">
  <p style="font-size:0.8rem;color:#888;">
    People Helping Pets · Chicago, IL · <a href="https://peoplehelpingpets.org" style="color:#888;">peoplehelpingpets.org</a>
  </p>
</body>
</html>`;

      await sendEmail(client.email, subject, html);
      sent++;
    }

    return res.status(200).json({ ok: true, sent, skipped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}