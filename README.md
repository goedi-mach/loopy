# People Helping Pets — Pawkit

Internal web tools for running free vaccine clinics. Built for [People Helping Pets](https://peoplehelpingpets.org), a Chicago-based nonprofit providing bilingual vaccine clinics for cats and dogs in underserved neighborhoods.

Live at: [clinic.phpchi.org](https://clinic.phpchi.org)

---

## Pages

| File | Purpose |
| ---- | ------- |
| `index.html` | Landing / home page |
| `intake.html` | Staff intake tool — client search, walk-in registration, check-in, pet records, client notes |
| `discharge.html` | Staff discharge tool — vaccine logging, microchip, certificate download, client notes |
| `records.html` | Sortable, filterable table of all clients and pets; CSV export |
| `client.html` | Client profile page — edit client/pet records, full vaccination history, cert download, signed waiver, client notes, file attachments |
| `reports.html` | Stats page with date/event filters, charts, per-event table, vaccine waste summary, CSV export |
| `staff-home.html` | Nav hub for staff — event management, user management, inventory, queue control |
| `volunteer-home.html` | Role picker (Intake/Discharge) for volunteers |
| `set-password.html` | Password setup page for new invited users |
| `login.html` | Login page, shared by staff and volunteers |
| `registration.html` | Public-facing self-registration form (bilingual EN/ES) |
| `queue-display.html` | Public-facing queue display — shows "Now Serving" numbers; auto-refreshes every 10 seconds |
| `queue-control.html` | Staff-only queue control panel — advance, go back, or reset the queue number |
| `merge-clients.html` | Staff tool for merging duplicate client records side-by-side |
| `user-management.html` | Admin tool for inviting users and managing roles |

---

## Key Features

### Client & Pet Management

- Walk-in client registration with duplicate detection (matched by email or phone)
- Up to 3 pets per registration on the public intake form
- Inline editing of client and pet records from both discharge and client profile
- Client and pet archiving (soft delete), with permanent delete for archived records
- **Client notes** — free-text notes attached to a client record, visible and editable across intake, discharge, and the client profile
- **Merge clients** — Salesforce-style side-by-side merge UI for resolving duplicate records; staff pick which fields to keep, pets and records are reassigned to the surviving client

### File Attachments

- Staff and volunteers can upload documents to any client or pet record
- Files stored in Supabase Storage (`attachments` bucket), organized by client ID
- Signed URLs generated on demand for secure viewing
- Upload and delete available in both `discharge.html` and `client.html`

### Vaccine Clinics

- Event creation and management in staff-home
- Clinic banner on discharge page when an event is active today
- **Booster Clinic mode** — when today's event is a Booster Clinic, the discharge page defaults to showing clients from the most recent completed Vaccine Clinic
- **Event completion flow** — closing an event prompts staff to log vaccine waste before finalizing
- **Vaccine waste tracking** — per-event log of drawn-but-unused doses by vaccine type; surfaced in reports

### Vaccine Inventory

- Active lot tracking per vaccine type (Rabies, DAPP, Lepto, FVRCP)
- Multiple active lots supported per vaccine type
- Lot expiration date display and enforcement — expired lots are flagged and blocked from logging
- Lot dropdown auto-populates on the discharge form from active inventory

### Queue Management

- **Queue display screen** (`queue-display.html`) — large-format display showing current and upcoming ticket numbers, designed for a TV or tablet facing the waiting area; no login required
- **Queue control panel** (`queue-control.html`) — staff advances the queue in batches of 3; accessible from staff-home
- **Floating queue widget** on the intake page — collapsed bubble that expands to show current numbers and next/back controls without leaving the page

### Reporting

- Stats filtered by date range or specific event
- Charts for vaccines administered, species breakdown, new vs. returning clients
- Per-event summary table
- **Vaccine waste report** — total doses wasted per vaccine type for the selected period
- CSV export

### Certificates

- Rabies certificates (NASPHV Form 51) generated entirely in the browser using [pdf-lib](https://pdf-lib.js.org/)
- Filled PDF downloaded directly — no server required
- Certificate available immediately after vaccine logging, and from vaccination history on the client profile
- **Spanish translation** — breed and color/markings fields submitted in Spanish are automatically translated to English via DeepL before the certificate is generated; staff can review and override the translated values

### Automated Vaccine Reminders

- Bilingual (English/Spanish) reminder emails sent at 2 weeks and 1 week before a pet's `next_due` date via Resend
- Booster-specific email path references the next upcoming Booster Clinic date from the `events` table
- Cron runs daily at 10am UTC via Vercel Cron Jobs
- Duplicate sends prevented by `reminder_2w_sent` and `reminder_1w_sent` flags on the `vaccinations` table
- Email consent clause included in the public intake waiver

### Auth & Roles

- Role-based access via Supabase JWT `app_metadata.role`
- Roles: `staff`, `volunteer` (default for untagged users)
- Staff vs. volunteer routing at login
- Admin user operations (invite, set role, list) via Vercel serverless function (`api/admin-users.js`)
- Invite flow redirects to `set-password.html`

### Sandbox Environment

- A sandbox deployment (`pawkit-sandbox.vercel.app`) exists for testing
- Pages with the sandbox hostname show a persistent red banner with a link back to production

---

## Serverless Functions (`api/`)

| File | Purpose |
| ---- | ------- |
| `api/admin-users.js` | User management — invite, list, set role |
| `api/send-reminders.js` | Vaccine reminder cron job (called by Vercel Cron) |
| `api/translate.js` | DeepL translation proxy — translates breed/color fields from Spanish to English for rabies certificates |

---

## Supabase Schema

### `clients` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `name` | `text` | Required |
| `email` | `text` | Optional |
| `phone` | `text` | Optional |
| `street` | `text` | Optional |
| `city` | `text` | Optional |
| `state` | `text` | Optional |
| `zip` | `text` | Optional |
| `address` | `text` | Legacy — kept for backward compatibility |
| `event_date` | `date` | Set on registration |
| `status` | `text` | `registered`, `checked_in`, `seen`, or `discharged` |
| `checked_in_at` | `timestamptz` | Optional |
| `seen_at` | `timestamptz` | Optional |
| `notes` | `text` | Permanent client notes |
| `archived` | `bool` | Default `false` |
| `waiver_signature` | `text` | Base64 PNG of drawn signature |
| `waiver_signed_at` | `timestamptz` | UTC timestamp of waiver signature |
| `created_at` | `timestamptz` | Default `now()` |

### `pets` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `client_id` | `uuid` | Foreign key → `clients.id` (cascade delete) |
| `name` | `text` | Required |
| `species` | `text` | `dog`, `cat`, `ferret`, or `other` |
| `breed` | `text` | Optional |
| `age` | `float8` | Optional, in years or months depending on `age_unit` |
| `age_unit` | `text` | `years` or `months` |
| `weight` | `float8` | Optional, in lbs |
| `sex` | `text` | `male`, `female`, or `unknown` |
| `altered` | `text` | `yes`, `no`, or `unknown` |
| `microchipped` | `text` | `yes`, `no`, or `unknown` |
| `microchip_number` | `text` | Optional |
| `colors_markings` | `text` | Optional |
| `archived` | `bool` | Default `false` |

### `vaccinations` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `pet_id` | `uuid` | Foreign key → `pets.id` |
| `vaccine_name` | `text` | e.g. `Rabies 1 Year`, `DAPP 1 Year`, `Lepto 1 Year`, `FVRCP 1 Year` |
| `product_name` | `text` | e.g. `IMRAB 3` |
| `manufacturer` | `text` | First 3 letters, uppercased |
| `lot_number` | `text` | Optional |
| `serial_number` | `text` | Legacy field |
| `rabies_tag_number` | `text` | Optional |
| `colors_markings` | `text` | Recorded at time of vaccination |
| `breed_en` | `text` | English-translated breed for certificate |
| `date_given` | `date` | Required |
| `next_due` | `date` | Optional |
| `exp_date` | `date` | Lot expiration date at time of logging |
| `administered_by` | `text` | Optional |
| `usda_duration` | `text` | `1yr`, `3yr`, or `4yr` |
| `dose_type` | `text` | `initial` or `booster` |
| `ac_license_number` | `text` | Animal control license number |
| `ac_license_type` | `text` | `1yr`, `3yr`, or `other` |
| `reminder_2w_sent` | `bool` | Default `false` — set when 2-week reminder is sent |
| `reminder_1w_sent` | `bool` | Default `false` — set when 1-week reminder is sent |
| `created_at` | `timestamptz` | Default `now()` |

### `events` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `location` | `text` | Required |
| `event_date` | `date` | Required |
| `start_time` | `time` | Required |
| `end_time` | `time` | Optional |
| `clinic_type` | `text` | `Vaccine Clinic` or `Booster Clinic` |
| `completed` | `bool` | Default `false` |
| `completed_at` | `timestamptz` | Set when event is closed |

### `vaccine_inventory` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` | Primary key |
| `vaccine_type` | `text` | e.g. `rabies`, `dapp`, `dapp_lepto`, `fvrcp` |
| `lot_number` | `text` | Required |
| `manufacturer` | `text` | Optional |
| `exp_date` | `date` | Optional |
| `active` | `bool` | Default `false` — only active lots appear in the discharge dropdown |

### `vaccine_waste` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `event_id` | `uuid` | Foreign key → `events.id` (cascade delete) |
| `vaccine_name` | `text` | e.g. `Rabies`, `DAPP`, `Lepto`, `FVRCP` |
| `doses_wasted` | `int` | Must be > 0 |
| `created_at` | `timestamptz` | Default `now()` |
| `created_by` | `uuid` | Foreign key → `auth.users.id` |

### `queue_state` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `int` | Always `1` — single row only |
| `now_serving` | `int` | Current ticket number batch start |
| `updated_at` | `timestamptz` | Updated on each advance/reset |

### `attachments` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `client_id` | `uuid` | Foreign key → `clients.id` |
| `pet_id` | `uuid` | Optional — if set, attachment belongs to a specific pet |
| `storage_path` | `text` | Full path in Supabase Storage (`attachments/clients/{id}/...`) |
| `display_name` | `text` | Original filename shown in the UI |
| `uploaded_by` | `uuid` | Foreign key → `auth.users.id` |
| `uploaded_at` | `timestamptz` | Default `now()` |

---

## RLS Policies

Row Level Security is enabled on all tables.

| Table | Role | Permissions |
| ----- | ---- | ----------- |
| `clients` | `anon` | INSERT, SELECT, UPDATE |
| `clients` | `authenticated` | SELECT, UPDATE, DELETE |
| `pets` | `anon` | INSERT, SELECT, UPDATE |
| `pets` | `authenticated` | SELECT, UPDATE, DELETE |
| `vaccinations` | `anon` | SELECT |
| `vaccinations` | `authenticated` | INSERT, SELECT, UPDATE, DELETE |
| `events` | `authenticated` | INSERT, SELECT, UPDATE, DELETE |
| `vaccine_inventory` | `authenticated` | INSERT, SELECT, UPDATE |
| `vaccine_waste` | `authenticated` | INSERT, SELECT |
| `queue_state` | `anon` | SELECT |
| `queue_state` | `authenticated` | SELECT, UPDATE |
| `attachments` | `authenticated` | INSERT, SELECT, DELETE |

---

## Supabase Storage

Two buckets are required:

**`templates`** (public) — upload:
- `RabiesVacCert.pdf` — the NASPHV Form 51 template
- `ana_signature.png` — Dr. Ana Valbuena's signature
- `alex_signature.png` — Dr. Alexandra Friedman's signature

**`attachments`** (private) — created automatically when files are uploaded. Signed URLs are used for secure access.

---

## Setup

### Environment Variables

The following variables must be set in Vercel (Settings → Environment Variables):

| Variable | Used by |
| -------- | ------- |
| `SUPABASE_URL` | All pages via `config.js` |
| `SUPABASE_ANON_KEY` | All pages via `config.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/send-reminders.js`, `api/admin-users.js` |
| `RESEND_API_KEY` | `api/send-reminders.js` |
| `DEEPL_API_KEY` | `api/translate.js` (free tier key ending in `:fx`) |
| `VET_LICENSE_ANA` | `config.js` — injected into cert generation |
| `VET_LICENSE_FRIEDMAN` | `config.js` — injected into cert generation |

### `config.js`

`config.js` is gitignored and generated at build time by `scripts/build-config.js`. It is served as a static file and loaded by all HTML pages via `<script src="config.js"></script>`.

For local development, create it manually in the project root:

```js
const CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-key-here",
  VET_LICENSE_ANA: "...",
  VET_LICENSE_FRIEDMAN: "...",
};
```

> ⚠️ Never commit `config.js` or real credentials to the repository.

### Running locally

No build step required. Create `config.js` as described above, then open any `.html` file in a browser or use VS Code's **Live Preview** extension. Full functionality requires a live internet connection and valid Supabase credentials.

### Keep-alive

A GitHub Actions workflow pings Supabase twice weekly to prevent the free-tier project from pausing due to inactivity between clinic events.

---

## Built with

- Plain HTML, CSS, and JavaScript — no frameworks, no npm
- [Supabase](https://supabase.com) — Postgres database, REST API, Auth, and Storage
- [Vercel](https://vercel.com) — hosting, serverless functions, and cron jobs (free tier)
- [pdf-lib](https://pdf-lib.js.org/) — in-browser PDF form filling for rabies certificates
- [Signature Pad](https://github.com/szimek/signature_pad) — drawn signature capture on intake forms
- [Resend](https://resend.com) — transactional email for vaccine reminders
- [DeepL API](https://www.deepl.com/pro#developer) — Spanish-to-English translation for certificate fields
- [Google Fonts](https://fonts.google.com) — Nunito + Nunito Sans

---

## Known Limitations

- Maximum of 3 pets per registration on the public intake form
- Client upsert matches by email or phone — names alone are not deduplicated
- No server-side validation; all validation is client-side
- Waiver signature is only captured via the public intake form — walk-in registrations do not currently collect a signature
- Queue numbers are manually managed and independent of check-in status
- Mobile-friendliness on staff-facing pages (discharge, records) is not yet optimized — scoped for future work