const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const FROM_EMAIL           = 'reminders@peoplehelpingpets.org';

const REACTION_DOC_EN = 'https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/VaccineTakeHome_ENG.pdf';
const REACTION_DOC_ES = 'https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/VacunasHojaInfo_ESP.pdf';
const SNIP_LINK       = 'https://www.chicago.gov/content/dam/city/depts/cacc/PDFiles/CACC%20Resource%20List.pdf';
const WEBSITE_LINK    = 'https://peoplehelpingpets.org';

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
  return (str || '')
    .replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '')
    .replace(/\\n/g, '<br>');
}

async function getTemplates(prefix) {
  const ids = [
    `${prefix}_subject`,
    `${prefix}_en`, `${prefix}_es`,
    `${prefix}_chip_en`, `${prefix}_chip_es`,
    `${prefix}_snip_en`, `${prefix}_snip_es`
  ];
  const map = {};
  await Promise.all(ids.map(async id => {
    const rows = await sbFetch(`email_templates?id=eq.${id}&select=id,subject,body`);
    if (Array.isArray(rows) && rows[0]) map[id] = rows[0];
  }));
  return map;
}

async function getNextBoosterClinic(afterDate) {
  const records = await sbFetch(
    `events?clinic_type=eq.Booster Clinic&completed=eq.false&event_date=gt.${afterDate}&order=event_date.asc&limit=1`
  );
  if (!Array.isArray(records) || !records.length) return null;
  const e    = records[0];
  const date = new Date(e.event_date + 'T12:00:00');
  return {
    en: `${date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })} at ${e.location}`,
    es: `${date.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} en ${e.location}`,
  };
}

function buildDueDates(pets, vaccinations) {
  // Group vaccinations by pet_id, keep only future next_due
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
    const items = vaxes.map(v => {
      const due = new Date(v.next_due + 'T12:00:00');
      return { name: v.vaccine_name, due };
    }).sort((a, b) => a.due - b.due);
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

  const isBooster = clinicType === 'Booster Clinic';
  const prefix    = isBooster ? 'postclinic_booster' : 'postclinic_vaccine';

  try {
    const tpl = await getTemplates(prefix);

    // Pull clients
    const clients = await sbFetch(
      `clients?event_date=eq.${eventDate}&archived=eq.false&select=id,name,email&limit=5000`
    );
    if (!Array.isArray(clients)) throw new Error('Could not load clients');

    const clientIds = clients.map(c => c.id);
    if (!clientIds.length) return res.status(200).json({ ok: true, sent: 0, skipped: 0 });

    // Pull pets
    const pets = await sbFetch(
      `pets?client_id=in.(${clientIds.join(',')})&archived=eq.false&select=id,client_id,name,microchip_number&limit=5000`
    );
    if (!Array.isArray(pets)) throw new Error('Could not load pets');

    // Pull snip interest from clients
    const snipClients = await sbFetch(
      `clients?id=in.(${clientIds.join(',')})&snip_interest=eq.true&select=id&limit=5000`
    );
    const snipSet = new Set(Array.isArray(snipClients) ? snipClients.map(c => c.id) : []);

    // Pull future vaccinations for all pets
    const petIds = pets.map(p => p.id);
    const today  = new Date().toISOString().split('T')[0];
    const vaccinations = petIds.length ? await sbFetch(
      `vaccinations?pet_id=in.(${petIds.join(',')})&next_due=gt.${today}&select=pet_id,vaccine_name,next_due&limit=5000`
    ) : [];

    // Group pets and vaccinations by client
    const petsByClient = {};
    pets.forEach(p => {
      if (!petsByClient[p.client_id]) petsByClient[p.client_id] = [];
      petsByClient[p.client_id].push(p);
    });

    const chipMap = {};
    pets.forEach(p => {
      if (p.microchip_number) {
        if (!chipMap[p.client_id]) chipMap[p.client_id] = [];
        chipMap[p.client_id].push({ name: p.name, number: p.microchip_number });
      }
    });

    // Get next booster clinic (vaccine sends only)
    const nextBooster = !isBooster ? await getNextBoosterClinic(eventDate) : null;

    const clinicDate = new Date(eventDate + 'T12:00:00');

    let sent = 0, skipped = 0;

    for (const client of clients) {
      if (!client.email) { skipped++; continue; }

      const firstName  = (client.name || 'there').split(' ')[0];
      const chips      = chipMap[client.id] || [];
      const hasSnip    = snipSet.has(client.id);
      const clientPets = petsByClient[client.id] || [];
      const dueDates   = buildDueDates(clientPets, Array.isArray(vaccinations) ? vaccinations : []);

      const baseVars = {
        owner_name:            firstName,
        clinic_date:           clinicDate.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }),
        clinic_date_es:        clinicDate.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' }),
        reaction_doc_en:       `<a href="${REACTION_DOC_EN}" style="color:#1a3a8f;">Vaccine Take-Home Information (English)</a>`,
        reaction_doc_es:       `<a href="${REACTION_DOC_ES}" style="color:#1a3a8f;">Información sobre Vacunas (Español)</a>`,
        pet_due_dates_en:      dueDates.en,
        pet_due_dates_es:      dueDates.es,
        next_booster_clinic:   nextBooster ? nextBooster.en : 'TBD — stay tuned for announcements',
        next_booster_clinic_es: nextBooster ? nextBooster.es : 'por anunciar — estén atentos',
        website_link:          `<a href="${WEBSITE_LINK}" style="color:#1a3a8f;">peoplehelpingpets.org</a>`,
        snip_link:             `<a href="${SNIP_LINK}" style="color:#1a3a8f;">View the resource list (PDF)</a>`,
        chip_links:            chips.map(c =>
          `<li><strong>${c.name}:</strong> <a href="https://nano.fitracking.com/register/chip?id=${c.number}&petId=" style="color:#1a3a8f;">Register chip ${c.number}</a></li>`
        ).join(''),
      };

      const enHeading = fill(tpl[`${prefix}_en`]?.subject, baseVars);
      const enBody    = fill(tpl[`${prefix}_en`]?.body,    baseVars);
      const esHeading = fill(tpl[`${prefix}_es`]?.subject, baseVars);
      const esBody    = fill(tpl[`${prefix}_es`]?.body,    baseVars);

      const chipBlockEn = chips.length ? `
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <p><strong>${fill(tpl[`${prefix}_chip_en`]?.subject, baseVars)}</strong></p>
        <p>${fill(tpl[`${prefix}_chip_en`]?.body, { ...baseVars, chip_links: '' })}</p>
        <ul style="margin:0.5rem 0 0 1rem;">${baseVars.chip_links}</ul>` : '';

      const chipBlockEs = chips.length ? `
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <p><strong>${fill(tpl[`${prefix}_chip_es`]?.subject, baseVars)}</strong></p>
        <p>${fill(tpl[`${prefix}_chip_es`]?.body, { ...baseVars, chip_links: '' })}</p>
        <ul style="margin:0.5rem 0 0 1rem;">${baseVars.chip_links}</ul>` : '';

      const snipBlockEn = hasSnip ? `
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <p><strong>${fill(tpl[`${prefix}_snip_en`]?.subject, baseVars)}</strong></p>
        <p>${fill(tpl[`${prefix}_snip_en`]?.body, baseVars)}</p>` : '';

      const snipBlockEs = hasSnip ? `
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <p><strong>${fill(tpl[`${prefix}_snip_es`]?.subject, baseVars)}</strong></p>
        <p>${fill(tpl[`${prefix}_snip_es`]?.body, baseVars)}</p>` : '';

      const subject = fill(tpl[`${prefix}_subject`]?.subject, baseVars);

      const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;color:#1a1a2e;">
  <img src="https://lzfhdzklfmmxbfmyscfl.supabase.co/storage/v1/object/public/templates/php-logo.png"
       alt="People Helping Pets" style="height:60px;margin-bottom:1.5rem;" />

  <h2 style="color:#1a3a8f;">${enHeading}</h2>
  <p style="white-space:pre-line;">${enBody}</p>
  ${chipBlockEn}
  ${snipBlockEn}

  <hr style="border:none;border-top:2px solid #dce6f9;margin:1.5rem 0;">

  <h2 style="color:#1a3a8f;">${esHeading}</h2>
  <p style="white-space:pre-line;">${esBody}</p>
  ${chipBlockEs}
  ${snipBlockEs}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;">
  <p style="font-size:12px;color:#888;">
    People Helping Pets · Chicago, IL ·
    <a href="${WEBSITE_LINK}" style="color:#888;">peoplehelpingpets.org</a>
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