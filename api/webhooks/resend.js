import { Webhook } from 'svix';

const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  return res.json();
}

async function sbInsert(table, body) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal'
    },
    body: JSON.stringify(body)
  });
}

// Match a Resend email_id back to the client it was sent to,
// checking both the post-clinic log and the reminder log.
async function lookupClientId(resendEmailId) {
  const pc = await sbFetch(`postclinic_email_log?resend_email_id=eq.${resendEmailId}&select=client_id&limit=1`);
  if (Array.isArray(pc) && pc[0]) return pc[0].client_id;

  const rem = await sbFetch(`reminder_email_log?resend_email_id=eq.${resendEmailId}&select=vaccination_id&limit=1`);
  if (Array.isArray(rem) && rem[0]) {
    const vax = await sbFetch(`vaccinations?id=eq.${rem[0].vaccination_id}&select=pets(client_id)&limit=1`);
    return vax?.[0]?.pets?.client_id || null;
  }
  return null;
}

const TRACKED_EVENTS = [
  'email.delivered',
  'email.bounced',
  'email.complained',
  'email.delivery_delayed',
  'email.opened',
  'email.clicked',
];

export async function POST(request) {
  const payload = await request.text(); // raw body — required for signature verification

  let event;
  try {
    const wh = new Webhook(RESEND_WEBHOOK_SECRET);
    event = wh.verify(payload, {
      'svix-id':        request.headers.get('svix-id'),
      'svix-timestamp': request.headers.get('svix-timestamp'),
      'svix-signature': request.headers.get('svix-signature'),
    });
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  if (TRACKED_EVENTS.includes(event.type)) {
    const emailId = event.data?.email_id;
    const to      = Array.isArray(event.data?.to) ? event.data.to[0] : event.data?.to;

    // Resend echoes tags back as a flat object on webhook events (not the
    // {name,value} array shape used when sending). Prefer these — they're
    // free — and only fall back to the log-table lookup for emails sent
    // before tagging was added.
    const tags      = event.data?.tags || {};
    const clientId  = tags.client_id || (emailId ? await lookupClientId(emailId) : null);
    const emailType = tags.email_type || null;

    await sbInsert('email_events', {
      resend_email_id: emailId || null,
      event_type:       event.type.replace('email.', ''),
      client_id:        clientId,
      email:             to || null,
      email_type:        emailType,
      raw_payload:       event,
    });
  }

  return new Response('OK', { status: 200 });
}