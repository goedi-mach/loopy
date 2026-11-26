// Organization settings for the serverless functions (org_settings table, read with the
// service-role key). Files starting with "_" are helpers, not API routes.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL     = (process.env.SITE_URL || '').replace(/\/$/, '');

// Used for anything that isn't set on the Settings page
const DEFAULTS = {
  org_name:               'Our clinic',
  city_region:            null,
  website_url:            null,
  logo_url:               null,
  primary_color:          '#1a3a8f',
  timezone:               'UTC',
  email_from:             null,
  resources_url:          null,
  take_home_en_url:       null,
  take_home_es_url:       null,
  microchip_register_url: null,
};

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Kept for a minute: a warm function reuses it, and a change on the Settings page
// shows up in emails within a minute.
let cached = null;

export async function loadOrg() {
  if (cached && Date.now() - cached.at < 60_000) return cached.org;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/org_settings?select=*&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const row = res.ok ? (await res.json())?.[0] || {} : {};
    const set = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== ''));
    const org = { ...DEFAULTS, ...set };
    if (res.ok) cached = { at: Date.now(), org };
    return org;
  } catch {
    return { ...DEFAULTS };
  }
}

// The organization's time zone (Settings page), e.g. 'America/Chicago'. UTC if it can't be read.
export async function orgTimeZone() {
  return (await loadOrg()).timezone;
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

// ─── EMAIL PIECES ──────────────────────────────────────────────

// Sender as '"Org Name" <address>'. The address's domain must be verified in Resend.
export function fromAddress(org) {
  const address = org.email_from || process.env.EMAIL_FROM;
  if (!address) throw new Error('No "From" email address is set (Staff Home → Settings → Emails).');
  const name = org.org_name.replace(/["\\<>\r\n]/g, '');
  return `"${name}" <${address}>`;
}

// "https://example.org/" -> "example.org"
export const websiteLabel = url => String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

// A link in the organization's color, or '' when there is no URL
export function emailLink(org, href, text) {
  if (!href) return '';
  return `<a href="${esc(href)}" style="color:${org.primary_color};">${esc(text)}</a>`;
}

// Microchip registration link for one chip, or null when no registry link is set.
// The setting holds a link with {chip} where the chip number goes.
export function chipRegisterUrl(org, chip) {
  if (!org.microchip_register_url) return null;
  return org.microchip_register_url.replace('{chip}', encodeURIComponent(chip));
}

// Template variables that come from Settings, for both HTML and plain-text use
export function orgTemplateVars(org) {
  const resources = emailLink(org, org.resources_url, 'View the resource list');
  return {
    html: {
      org_name:        esc(org.org_name),
      website_link:    emailLink(org, org.website_url, websiteLabel(org.website_url)),
      snip_link:       resources,
      lowcost_link:    resources,
      reaction_doc_en: emailLink(org, org.take_home_en_url, 'Vaccine Take-Home Information (English)'),
      reaction_doc_es: emailLink(org, org.take_home_es_url, 'Información sobre Vacunas (Español)'),
    },
    text: {
      org_name:     org.org_name,
      website_link: org.website_url || '',
      snip_link:    org.resources_url || '',
      lowcost_link: org.resources_url || '',
    },
  };
}

// Logo (or the name, when there's no logo) at the top of every email
export function emailHeader(org) {
  const logo = org.logo_url || (SITE_URL ? `${SITE_URL}/logo.png` : null);
  return logo
    ? `<img src="${esc(logo)}" alt="${esc(org.org_name)}" style="height:60px;margin-bottom:1.5rem;" />`
    : `<h1 style="color:${org.primary_color};font-size:20px;margin:0 0 1.5rem;">${esc(org.org_name)}</h1>`;
}

// "Org Name · City, ST · example.org" at the bottom of every email
export function emailFooter(org) {
  const parts = [
    esc(org.org_name),
    org.city_region && esc(org.city_region),
    org.website_url && `<a href="${esc(org.website_url)}" style="color:#888;">${esc(websiteLabel(org.website_url))}</a>`,
  ].filter(Boolean);
  return `<p style="font-size:12px;color:#888;">${parts.join(' · ')}</p>`;
}
