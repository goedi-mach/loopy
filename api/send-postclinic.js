const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const FROM_EMAIL           = 'reminders@peoplehelpingpets.org';

const REACTION_DOC_EN = 'https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/VaccineTakeHome_ENG.pdf';
const REACTION_DOC_ES = 'https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/VacunasHojaInfo_ESP.pdf';
const SNIP_LINK       = 'https://www.chicago.gov/content/dam/city/depts/cacc/PDFiles/CACC%20Resource%20List.pdf';

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  return res.json();
}

function fill(str, vars) {
  return (str || '').replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '');
}

async function getTemplates() {
  const rows = await sbFetch(
    'email_templates?id=in.(postclinic_subject,postclinic_en,postclinic_es,postclinic_chip_en,postclinic_chip_es,postclinic_snip_en,postclinic_snip_es)&select=id,subject,body'
  );
  const map = {};
  rows.forEach(r => { map[r.id] = r; });
  return map;
}

async function getNextClinic(afterDate) {
  const records = await sbFetch(
    `events?completed=eq.false&event_date=gt.${afterDate}&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || !records.length) return null;
  const e    = records[0];
  const date = new Date(e.event_date + 'T12:00:00');
  return {
    date_en:      date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }),
    date_es:      date.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' }),
    location:     e.location || '',
    type_en:      e.clinic_type || 'Clinic',
    type_es:      e.clinic_type === 'Booster Clinic' ? 'Clínica de Refuerzo' : 'Clínica de Vacunas',
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
    // Load templates from DB
    const tpl = await getTemplates();

    // Pull clients
    const clients = await sbFetch(
      `clients?event_date=eq.${eventDate}&archived=eq.false&select=id,name,email&limit=5000`
    );

    // Pull pets
    const clientIds = clients.map(c => c.id);
    const snipSet   = new Set();
    const chipMap   = {};
    if (clientIds.length) {
      const pets = await sbFetch(
        `pets?client_id=in.(${clientIds.join(',')})&select=client_id,name,microchip_number&limit=5000`
      );
      // snip_interest lives on clients table
      const snipClients = await sbFetch(
        `clients?id=in.(${clientIds.join(',')})&snip_interest=eq.true&select=id&limit=5000`
      );
      snipClients.forEach(c => snipSet.add(c.id));
      if (!Array.isArray(pets)) throw new Error('Could not load pets: ' + JSON.stringify(pets));
      pets.forEach(p => {
        if (p.microchip_number) {
          if (!chipMap[p.client_id]) chipMap[p.client_id] = [];
          chipMap[p.client_id].push({ name: p.name, number: p.microchip_number });
        }
      });
    }

    // Get next clinic
    const nextClinic = await getNextClinic(eventDate);

    const clinicDate   = new Date(eventDate + 'T12:00:00');
    const clinicTypeEs = clinicType === 'Booster Clinic' ? 'Clínica de Refuerzo' : 'Clínica de Vacunas';

    const nextLineEn = nextClinic
      ? `Our next ${nextClinic.type_en} is on ${nextClinic.date_en} at ${nextClinic.location}. We hope to see you there!`
      : `Keep an eye out for announcements about our upcoming clinics!`;
    const nextLineEs = nextClinic
      ? `Nuestra próxima ${nextClinic.type_es} es el ${nextClinic.date_es} en ${nextClinic.location}. ¡Esperamos verlos!`
      : `¡Estén atentos a los anuncios sobre nuestras próximas clínicas!`;

    let sent = 0, skipped = 0;

    for (const client of clients) {
      if (!client.email) { skipped++; continue; }

      const firstName    = (client.name || 'there').split(' ')[0];
      const chips        = chipMap[client.id] || [];
      const hasSnip      = snipSet.has(client.id);

      const baseVars = {
        owner_name:        firstName,
        clinic_type:       clinicType || 'Clinic',
        clinic_type_es:    clinicTypeEs,
        clinic_date:       clinicDate.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }),
        clinic_date_es:    clinicDate.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' }),
        next_clinic_line_en: nextLineEn,
        next_clinic_line_es: nextLineEs,
        reaction_doc_en:   REACTION_DOC_EN,
        reaction_doc_es:   REACTION_DOC_ES,
        snip_link:         SNIP_LINK,
        chip_links:        chips.map(c =>
          `<li><strong>${c.name}:</strong> <a href="https://nano.fitracking.com/register/chip?id=${c.number}&petId=" style="color:#1a3a8f;">Register chip ${c.number}</a></li>`
        ).join(''),
      };

      // Build sections from DB templates
      const enHeading  = fill(tpl.postclinic_en?.subject, baseVars);
      const enBody     = fill(tpl.postclinic_en?.body,    baseVars);
      const esHeading  = fill(tpl.postclinic_es?.subject, baseVars);
      const esBody     = fill(tpl.postclinic_es?.body,    baseVars);

      const chipBlockEn = chips.length ? `
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <p><strong>${fill(tpl.postclinic_chip_en?.subject, baseVars)}</strong></p>
        <p>${fill(tpl.postclinic_chip_en?.body, baseVars)}</p>
        <ul style="margin:0.5rem 0 0 1rem;">${baseVars.chip_links}</ul>` : '';

      const chipBlockEs = chips.length ? `
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <p><strong>${fill(tpl.postclinic_chip_es?.subject, baseVars)}</strong></p>
        <p>${fill(tpl.postclinic_chip_es?.body, baseVars)}</p>
        <ul style="margin:0.5rem 0 0 1rem;">${baseVars.chip_links}</ul>` : '';

      const snipBlockEn = hasSnip ? `
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <p><strong>${fill(tpl.postclinic_snip_en?.subject, baseVars)}</strong></p>
        <p>${fill(tpl.postclinic_snip_en?.body, baseVars)}</p>` : '';

      const snipBlockEs = hasSnip ? `
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <p><strong>${fill(tpl.postclinic_snip_es?.subject, baseVars)}</strong></p>
        <p>${fill(tpl.postclinic_snip_es?.body, baseVars)}</p>` : '';

      const subject = fill(tpl.postclinic_subject?.subject, baseVars);

      const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;color:#1a1a2e;">
  <img src="https://peoplehelpingpets.org/wp-content/uploads/2024/01/PHP-Logo.png"
       alt="People Helping Pets" style="height:60px;margin-bottom:1.5rem;" />

  <!-- ENGLISH -->
  <h2 style="color:#1a3a8f;">${enHeading}</h2>
  <p style="white-space:pre-line;">${enBody}</p>
  ${chipBlockEn}
  ${snipBlockEn}

  <hr style="border:none;border-top:2px solid #dce6f9;margin:1.5rem 0;">

  <!-- ESPAÑOL -->
  <h2 style="color:#1a3a8f;">${esHeading}</h2>
  <p style="white-space:pre-line;">${esBody}</p>
  ${chipBlockEs}
  ${snipBlockEs}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;">
  <p style="font-size:12px;color:#888;">
    People Helping Pets · Chicago, IL ·
    <a href="https://peoplehelpingpets.org" style="color:#888;">peoplehelpingpets.org</a>
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