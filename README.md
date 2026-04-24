# People Helping Pets — Pawkit

Internal web tools for running free vaccine clinics. Built for [People Helping Pets](https://peoplehelpingpets.org), a Chicago-based nonprofit providing bilingual vaccine clinics for cats and dogs in underserved neighborhoods.

---

## Pages

| File                  | Purpose                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.html`          | Landing / home page                                                                                            |
| `intake.html`         | Staff intake tool — client search, walk-in registration, check-in, pet records, client notes                   |
| `discharge.html`      | Staff discharge tool — vaccine logging, microchip, certificate download, mark as seen, client notes            |
| `dashboard.html`      | Role-selector landing page — routes staff to the appropriate tool                                              |
| `records.html`        | Sortable, filterable table of all clients and pets; CSV export                                                 |
| `client.html`         | Client profile page — edit client/pet records, vaccination history, cert download, signed waiver, client notes |
| `reports.html`        | Stats page with date/event filters, charts, per-event table, vaccine waste summary, CSV export                 |
| `staff-home.html`     | Nav hub for staff — event management, user management, queue control tile                                      |
| `volunteer-home.html` | Role picker (Intake/Discharge) for volunteers                                                                  |
| `set-password.html`   | Password setup page for new invited users                                                                      |
| `queue-display.html`  | Public-facing queue display — shows "Now Serving" numbers for the crowd; auto-refreshes every 10 seconds       |
| `queue-control.html`  | Staff-only queue control panel — advance, go back, or reset the queue number                                   |

---

## Key Features

### Client & Pet Management

- Walk-in client registration with duplicate detection and fuzzy name matching
- Up to 3 pets per registration on the public intake form
- Inline editing of client and pet records
- Client archiving
- **Permanent client notes** — free-text notes attached to a client record, visible and editable in intake, discharge, and the client profile

### Vaccine Clinics

- Event creation and management in staff-home
- Clinic banner on intake and discharge pages when an event is active today
- **Event completion flow** — closing an event prompts staff to log vaccine waste before finalizing
- **Vaccine waste tracking** — per-event log of drawn-but-unused doses by vaccine type; surfaced in reports

### Queue Management

- **Queue display screen** (`queue-display.html`) — large-format display showing current and upcoming ticket numbers, designed for a TV or tablet facing the waiting area; no login required
- **Queue control panel** (`queue-control.html`) — staff advances the queue in batches of 3; accessible from staff-home
- **Floating queue widget** on the intake page — collapsed emoji bubble that expands to show current numbers and next/back controls without leaving the page
- Queue numbers are manually managed and independent of check-in status, suitable for outdoor waiting areas

### Reporting

- Stats filtered by date range or specific event
- Charts for vaccines administered, species breakdown, new vs. returning clients
- Per-event summary table
- **Vaccine waste report** — total doses wasted per vaccine type for the selected period
- CSV export

### Certificates

- Rabies certificates (NASPHV Form 51) generated entirely in the browser using [pdf-lib](https://pdf-lib.js.org/)
- No server required; filled PDF downloaded directly

### Auth & Roles

- Role-based access via Supabase JWT `app_metadata.role`
- Staff vs. volunteer routing at login
- Admin user operations (invite, set role, list) via Vercel serverless function
- Invite flow redirects to `set-password.html`

---

## Supabase Schema

### `clients` table

| Column             | Type          | Notes                                    |
| ------------------ | ------------- | ---------------------------------------- |
| `id`               | `uuid`        | Primary key, default `gen_random_uuid()` |
| `name`             | `text`        | Required                                 |
| `email`            | `text`        | Optional                                 |
| `phone`            | `text`        | Optional                                 |
| `street`           | `text`        | Optional                                 |
| `city`             | `text`        | Optional                                 |
| `state`            | `text`        | Optional                                 |
| `zip`              | `text`        | Optional                                 |
| `address`          | `text`        | Legacy — kept for backward compatibility |
| `event_date`       | `date`        | Set on registration                      |
| `status`           | `text`        | `registered`, `checked_in`, or `seen`    |
| `checked_in_at`    | `timestamptz` | Optional                                 |
| `seen_at`          | `timestamptz` | Optional                                 |
| `notes`            | `text`        | Permanent client notes                   |
| `archived`         | `bool`        | Default `false`                          |
| `waiver_signature` | `text`        | Base64 PNG of drawn signature            |
| `waiver_signed_at` | `timestamptz` | UTC timestamp of waiver signature        |
| `created_at`       | `timestamptz` | Default `now()`                          |

### `pets` table

| Column             | Type     | Notes                                       |
| ------------------ | -------- | ------------------------------------------- |
| `id`               | `uuid`   | Primary key, default `gen_random_uuid()`    |
| `client_id`        | `uuid`   | Foreign key → `clients.id` (cascade delete) |
| `name`             | `text`   | Required                                    |
| `species`          | `text`   | `dog`, `cat`, `ferret`, or `other`          |
| `breed`            | `text`   | Optional                                    |
| `age`              | `float8` | Optional, in years                          |
| `age_unit`         | `text`   | `years` or `months`                         |
| `weight`           | `float8` | Optional, in lbs                            |
| `sex`              | `text`   | `male`, `female`, or `unknown`              |
| `altered`          | `text`   | `yes`, `no`, or `unknown`                   |
| `microchipped`     | `text`   | `yes`, `no`, or `unknown`                   |
| `microchip_number` | `text`   | Optional                                    |
| `colors_markings`  | `text`   | Optional                                    |
| `archived`         | `bool`   | Default `false`                             |

### `vaccinations` table

| Column              | Type          | Notes                                      |
| ------------------- | ------------- | ------------------------------------------ |
| `id`                | `uuid`        | Primary key, default `gen_random_uuid()`   |
| `pet_id`            | `uuid`        | Foreign key → `pets.id`                    |
| `vaccine_name`      | `text`        | e.g. `Rabies`                              |
| `product_name`      | `text`        | e.g. `IMRAB 3`                             |
| `manufacturer`      | `text`        | First 3 letters, uppercased                |
| `lot_number`        | `text`        | Optional                                   |
| `serial_number`     | `text`        | Optional                                   |
| `rabies_tag_number` | `text`        | Optional                                   |
| `colors_markings`   | `text`        | Optional — recorded at time of vaccination |
| `date_given`        | `date`        | Required                                   |
| `next_due`          | `date`        | Optional                                   |
| `administered_by`   | `text`        | Optional                                   |
| `usda_duration`     | `text`        | `1yr`, `3yr`, or `4yr`                     |
| `dose_type`         | `text`        | `initial` or `booster`                     |
| `ac_license_number` | `text`        | Animal control license number              |
| `ac_license_type`   | `text`        | `1yr`, `3yr`, or `other`                   |
| `created_at`        | `timestamptz` | Default `now()`                            |

### `events` table

| Column         | Type          | Notes                                    |
| -------------- | ------------- | ---------------------------------------- |
| `id`           | `uuid`        | Primary key, default `gen_random_uuid()` |
| `location`     | `text`        | Required                                 |
| `event_date`   | `date`        | Required                                 |
| `start_time`   | `time`        | Required                                 |
| `end_time`     | `time`        | Optional                                 |
| `notes`        | `text`        | e.g. `Vaccine Clinic`, `Booster Clinic`  |
| `completed`    | `bool`        | Default `false`                          |
| `completed_at` | `timestamptz` | Set when event is closed                 |

### `vaccine_waste` table

| Column         | Type          | Notes                                          |
| -------------- | ------------- | ---------------------------------------------- |
| `id`           | `uuid`        | Primary key, default `gen_random_uuid()`       |
| `event_id`     | `uuid`        | Foreign key → `events.id` (cascade delete)     |
| `vaccine_name` | `text`        | e.g. `Rabies`, `DAPP`, `DAPP + Lepto`, `FVRCP` |
| `doses_wasted` | `int`         | Must be > 0                                    |
| `created_at`   | `timestamptz` | Default `now()`                                |
| `created_by`   | `uuid`        | Foreign key → `auth.users.id`                  |

### `queue_state` table

| Column        | Type          | Notes                             |
| ------------- | ------------- | --------------------------------- |
| `id`          | `int`         | Always `1` — single row only      |
| `now_serving` | `int`         | Current ticket number batch start |
| `updated_at`  | `timestamptz` | Updated on each advance/reset     |

---

## RLS Policies

Row Level Security is enabled on all tables.

| Table           | Role            | Permissions                    |
| --------------- | --------------- | ------------------------------ |
| `clients`       | `anon`          | INSERT, SELECT, UPDATE         |
| `clients`       | `authenticated` | SELECT, UPDATE, DELETE         |
| `pets`          | `anon`          | INSERT, SELECT, UPDATE         |
| `pets`          | `authenticated` | SELECT, UPDATE, DELETE         |
| `vaccinations`  | `anon`          | SELECT                         |
| `vaccinations`  | `authenticated` | INSERT, SELECT, UPDATE, DELETE |
| `events`        | `authenticated` | INSERT, SELECT, UPDATE, DELETE |
| `vaccine_waste` | `authenticated` | INSERT, SELECT                 |
| `queue_state`   | `anon`          | SELECT                         |
| `queue_state`   | `authenticated` | SELECT, UPDATE                 |

---

## Supabase Storage

Create a storage bucket named `templates` and set it to **public**. Upload:

- `RabiesVacCert.pdf` — the NASPHV Form 51 template
- `ana_signature.png` — the veterinarian's signature image

---

## Setup

### Credentials

Credentials are managed via `config.js`, which is gitignored and generated at build time by `scripts/build-config.js` using Vercel environment variables.

For local development, create `config.js` manually in the project root:

```js
const CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-key-here",
};
```

Both values are found in your Supabase project under **Settings → API**.

> ⚠️ Never commit `config.js` or real credentials to the repository.

### Running locally

No build step required. Create `config.js` as described above, then open any `.html` file in a browser or use VS Code's **Live Preview** extension.

Since most pages depend on Supabase for data, full functionality requires a live internet connection and valid credentials.

---

## Certificate Generation

Rabies certificates are generated entirely in the browser using [pdf-lib](https://pdf-lib.js.org/). The filled PDF is downloaded directly — no server required.

A standalone Python script (`fill_cert.py`) also exists for local CLI-based certificate generation:

```bash
python fill_cert.py <vaccination_id>
```

Requires: `pypdf`, `requests`, `python-dateutil`, `reportlab`

---

## Built with

- Plain HTML, CSS, and JavaScript — no frameworks, no npm
- [Supabase](https://supabase.com) — Postgres database, REST API, Auth, and Storage
- [Vercel](https://vercel.com) — hosting + serverless functions (free tier)
- [pdf-lib](https://pdf-lib.js.org/) — in-browser PDF form filling
- [Signature Pad](https://github.com/szimek/signature_pad) — drawn signature capture
- [Google Fonts](https://fonts.google.com) — Nunito + Nunito Sans

---

## Known Limitations

- Maximum of 3 pets per registration on the public intake form
- Client upsert matches by email or phone — names alone are not deduplicated
- No server-side validation; all validation is client-side
- Waiver signature is only captured via the public intake form — walk-in registrations do not currently collect a signature
- Queue numbers are manually managed; no automatic tie to check-in order
