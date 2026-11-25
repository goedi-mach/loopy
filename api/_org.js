// Organization settings for the serverless functions (org_settings table, read with the
// service-role key). Files starting with "_" are helpers, not API routes.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The organization's time zone (Settings page), e.g. 'America/Chicago'. UTC if it can't be read.
export async function orgTimeZone() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/org_settings?select=timezone&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const rows = res.ok ? await res.json() : [];
    return rows?.[0]?.timezone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Today's date in the organization's time zone as YYYY-MM-DD (not UTC).
export async function orgToday() {
  const tz = await orgTimeZone();
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    // An unknown time zone name: fall back to UTC rather than failing the whole send
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
  }
}
