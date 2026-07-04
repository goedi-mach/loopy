# People Helping Pets — Pawkit

Internal web tools for running free vaccine clinics. Built for [People Helping Pets](https://peoplehelpingpets.org), a Chicago-based nonprofit providing bilingual vaccine clinics for cats and dogs in underserved neighborhoods.

---

## Pages

| File                  | Purpose                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.html`          | Landing / home page                                                                                            |
| `login.html`          | Staff and volunteer sign-in                                                                                    |
| `registration.html`   | Public-facing bilingual client registration & waiver form                                                      |
| `intake.html`         | Staff intake tool — client search, walk-in registration, check-in, pet records, client notes                   |
| `discharge.html`      | Staff discharge tool — vaccine logging, microchip, certificate download, mark as seen, client notes            |
| `records.html`        | Sortable, filterable table of all clients and pets; CSV export                                                 |
| `client.html`         | Client profile page — edit client/pet records, vaccination history, cert download, signed waiver, client notes |
| `reports.html`        | Stats page with date/event filters, charts, per-event table, vaccine waste summary, CSV export                 |
| `staff-home.html`     | Nav hub for staff — event management, user management, queue control tile                                      |
| `volunteer-home.html` | Role picker (Intake/Discharge) for volunteers                                                                  |
| `set-password.html`   | Password setup page for new invited users                                                                      |

### Staff Tools (`tools/`)

| File                         | Purpose                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/reminders.html`       | Reminder Manager — edit email templates, view upcoming/sent reminders, manual sends, conditional email triggers, send-failure & bounce monitoring |
| `tools/user-management.html` | Admin user management — invite staff/volunteers, set roles                                                                                        |
| `tools/queue-control.html`   | Staff-only queue control panel — advance, go back, or reset the queue number                                                                      |
| `tools/queue-display.html`   | Public-facing queue display — shows "Now Serving" numbers for the crowd; auto-refreshes every 10 seconds                                          |

### Serverless Functions (`api/`)

| File                          | Purpose                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `api/translate.js`            | Proxies breed/color translation requests to DeepL (used for rabies certificates)                     |
| `api/send-postclinic.js`      | Sends bilingual post-clinic follow-up emails in batches via Resend, with conditional trigger blocks  |
| `api/send-reminders.js`       | Daily cron (10am UTC) — sends 2-week and 1-week vaccine due reminders in batches via Resend          |
| `api/send-reminder-manual.js` | Manually triggers a single reminder email from the Reminder Manager                                  |
| `api/webhooks/resend.js`      | Receives signed, real-time delivery/bounce/complaint events from Resend; logs them to `email_events` |

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

- **Queue display screen** (`tools/queue-display.html`) — large-format display showing current and upcoming ticket numbers, designed for a TV or tablet facing the waiting area; no login required
- **Queue control panel** (`tools/queue-control.html`) — staff advances the queue in batches of 3; accessible from staff-home
- **Floating queue widget** on the intake page — collapsed emoji bubble that expands to show current numbers and next/back controls without leaving the page
- Queue numbers are manually managed and independent of check-in status, suitable for outdoor waiting areas

### Email System

- Automated bilingual (English/Spanish) reminder emails sent 2 weeks and 1 week before a pet's `next_due` date, via a daily cron job
- Post-clinic follow-up emails sent per clinic event, with conditional content blocks controlled by **triggers** — e.g. microchip registration info only if a chip is on file, spay/neuter resources only if the client expressed interest, ZIP-restricted content
- All templates and triggers are editable from the **Reminder Manager** (`tools/reminders.html`) — no code changes needed to update email copy or add new conditional content
- **Preview mode** shows every distinct email variant (based on which triggers fire) before a real send goes out
- Emails are sent in batches via [Resend](https://resend.com)'s `/emails/batch` endpoint (up to 100 per call) rather than one at a time, to minimize API calls and rate-limit risk
- **Failure & bounce tracking** — send failures and Resend-reported bounces/complaints are logged to dedicated tables and surfaced in a "Failures" tab in the Reminder Manager; a signed webhook (`api/webhooks/resend.js`) receives real-time delivery events from Resend

### Reporting

- Stats filtered by date range or specific event
- Charts for vaccines administered, species breakdown, new vs. returning clients
- Per-event summary table
- **Vaccine waste report** — total doses wasted per vaccine type for the selected period
- CSV export

### Certificates

- Rabies certificates (NASPHV Form 51) generated entirely in the browser using [pdf-lib](https://pdf-lib.js.org/)
- Breed and colors/markings fields are automatically translated from Spanish to English via DeepL when needed, since the certificate is a legal document requiring English
- No server required for the PDF itself; the filled PDF is downloaded directly

### Auth & Roles

- Role-based access via Supabase JWT `app_metadata.role`
- Staff vs. volunteer routing at login
- Admin user operations (invite, set role, list) via `tools/user-management.html` and supporting Vercel serverless functions
- Invite flow redirects to `set-password.html`

---

## Supabase Schema

### `clients` table

| Column               | Type          | Notes                                              |
| -------------------- | ------------- | -------------------------------------------------- |
| `id`                 | `uuid`        | Primary key, default `gen_random_uuid()`           |
| `name`               | `text`        | Required                                           |
| `email`              | `text`        | Optional                                           |
| `phone`              | `text`        | Optional                                           |
| `street`             | `text`        | Optional                                           |
| `city`               | `text`        | Optional                                           |
| `state`              | `text`        | Optional                                           |
| `zip`                | `text`        | Optional                                           |
| `address`            | `text`        | Legacy — kept for backward compatibility           |
| `event_date`         | `date`        | Set on registration                                |
| `status`             | `text`        | `registered`, `checked_in`, or `seen`              |
| `checked_in_at`      | `timestamptz` | Optional                                           |
| `seen_at`            | `timestamptz` | Optional                                           |
| `notes`              | `text`        | Permanent client notes                             |
| `snip_interest`      | `bool`        | Client expressed interest in spay/neuter resources |
| `preferred_language` | `text`        | `en` or `es`; used for trigger conditions          |
| `archived`           | `bool`        | Default `false`                                    |
| `waiver_signature`   | `text`        | Base64 PNG of drawn signature                      |
| `waiver_signed_at`   | `timestamptz` | UTC timestamp of waiver signature                  |
| `created_at`         | `timestamptz` | Default `now()`                                    |

### `pets` table

| Column             | Type     | Notes                                       |
| ------------------ | -------- | ------------------------------------------- |
| `id`               | `uuid`   | Primary key, default `gen_random_uuid()`    |
| `client_id`        | `uuid`   | Foreign key → `clients.id` (cascade delete) |
| `name`             | `text`   | Required                                    |
| `species`          | `text`   | `dog`, `cat`, `ferret`, or `other`          |
| `breed`            | `text`   | Optional                                    |
| `age`              | `float8` | Optional                                    |
| `age_unit`         | `text`   | `years` or `months`                         |
| `weight`           | `float8` | Optional, in lbs                            |
| `sex`              | `text`   | `male`, `female`, or `unknown`              |
| `altered`          | `text`   | `yes`, `no`, or `unknown`                   |
| `microchipped`     | `text`   | `yes`, `no`, or `unknown`                   |
| `microchip_number` | `text`   | Optional                                    |
| `colors_markings`  | `text`   | Optional                                    |
| `archived`         | `bool`   | Default `false`                             |

### `vaccinations` table

| Column              | Type          | Notes                                                      |
| ------------------- | ------------- | ---------------------------------------------------------- |
| `id`                | `uuid`        | Primary key, default `gen_random_uuid()`                   |
| `pet_id`            | `uuid`        | Foreign key → `pets.id`                                    |
| `vaccine_name`      | `text`        | e.g. `Rabies`, `Lepto`                                     |
| `product_name`      | `text`        | e.g. `IMRAB 3`                                             |
| `manufacturer`      | `text`        | First 3 letters, uppercased                                |
| `lot_number`        | `text`        | Optional                                                   |
| `serial_number`     | `text`        | Optional                                                   |
| `rabies_tag_number` | `text`        | Optional                                                   |
| `colors_markings`   | `text`        | Optional — recorded at time of vaccination                 |
| `breed_en`          | `text`        | English breed translation, for rabies certificates         |
| `date_given`        | `date`        | Required                                                   |
| `next_due`          | `date`        | Optional                                                   |
| `administered_by`   | `text`        | Optional                                                   |
| `usda_duration`     | `text`        | `1yr`, `3yr`, or `4yr`                                     |
| `dose_type`         | `text`        | `initial` or `booster`                                     |
| `ac_license_number` | `text`        | Animal control license number                              |
| `ac_license_type`   | `text`        | `1yr`, `3yr`, or `other`                                   |
| `reminder_2w_sent`  | `bool`        | Default `false`; set after successful 2-week reminder send |
| `reminder_1w_sent`  | `bool`        | Default `false`; set after successful 1-week reminder send |
| `created_at`        | `timestamptz` | Default `now()`                                            |

### `events` table

| Column         | Type          | Notes                                    |
| -------------- | ------------- | ---------------------------------------- |
| `id`           | `uuid`        | Primary key, default `gen_random_uuid()` |
| `location`     | `text`        | Required                                 |
| `event_date`   | `date`        | Required                                 |
| `start_time`   | `time`        | Required                                 |
| `end_time`     | `time`        | Optional                                 |
| `clinic_type`  | `text`        | e.g. `Vaccine Clinic`, `Booster Clinic`  |
| `completed`    | `bool`        | Default `false`                          |
| `completed_at` | `timestamptz` | Set when event is closed                 |

### `vaccine_waste` table

| Column         | Type          | Notes                                      |
| -------------- | ------------- | ------------------------------------------ |
| `id`           | `uuid`        | Primary key, default `gen_random_uuid()`   |
| `event_id`     | `uuid`        | Foreign key → `events.id` (cascade delete) |
| `vaccine_name` | `text`        | e.g. `Rabies`, `DAPP`, `Lepto`, `FVRCP`    |
| `doses_wasted` | `int`         | Must be > 0                                |
| `created_at`   | `timestamptz` | Default `now()`                            |
| `created_by`   | `uuid`        | Foreign key → `auth.users.id`              |

### `queue_state` table

| Column        | Type          | Notes                             |
| ------------- | ------------- | --------------------------------- |
| `id`          | `int`         | Always `1` — single row only      |
| `now_serving` | `int`         | Current ticket number batch start |
| `updated_at`  | `timestamptz` | Updated on each advance/reset     |

### `email_templates` table

| Column       | Type          | Notes                                                            |
| ------------ | ------------- | ---------------------------------------------------------------- |
| `id`         | `text`        | Primary key, e.g. `reminder_2w_en`, `postclinic_vaccine_subject` |
| `subject`    | `text`        | Optional depending on template type                              |
| `body`       | `text`        | Supports `{{placeholder}}` variable substitution                 |
| `updated_at` | `timestamptz` |                                                                  |

### `triggers` table

Controls conditional email content for post-clinic and reminder emails.

| Column        | Type          | Notes                                                                                                                     |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `text`        | Primary key, slugified from name                                                                                          |
| `name`        | `text`        | Required                                                                                                                  |
| `description` | `text`        | Optional                                                                                                                  |
| `event`       | `text`        | `post_clinic`, `post_booster`, `reminder_2w`, or `reminder_1w`                                                            |
| `conditions`  | `jsonb`       | Supported keys: `has_intact_pet`, `has_microchip`, `has_upcoming_due`, `zip` (array), `clinic_type`, `preferred_language` |
| `template_en` | `text`        | References `email_templates.id`                                                                                           |
| `template_es` | `text`        | References `email_templates.id`                                                                                           |
| `active`      | `bool`        |                                                                                                                           |
| `created_at`  | `timestamptz` |                                                                                                                           |
| `updated_at`  | `timestamptz` |                                                                                                                           |

### `postclinic_email_log` table

Prevents double-emailing a client for the same clinic event on retry/resume.

| Column            | Type   | Notes                                                                                            |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `id`              | `uuid` | Primary key, default `gen_random_uuid()`                                                         |
| `client_id`       | `uuid` | Foreign key → `clients.id`                                                                       |
| `event_date`      | `date` |                                                                                                  |
| `clinic_type`     | `text` |                                                                                                  |
| `resend_email_id` | `text` | Resend-assigned email ID; used by the webhook to match bounce/complaint events back to this send |

### `reminder_email_log` table

Mirrors `postclinic_email_log`'s role for reminder emails.

| Column            | Type          | Notes                                    |
| ----------------- | ------------- | ---------------------------------------- |
| `id`              | `uuid`        | Primary key, default `gen_random_uuid()` |
| `vaccination_id`  | `uuid`        | Foreign key → `vaccinations.id`          |
| `reminder_type`   | `text`        | `2w` or `1w`                             |
| `resend_email_id` | `text`        | Resend-assigned email ID                 |
| `sent_at`         | `timestamptz` | Default `now()`                          |

Unique constraint on `(vaccination_id, reminder_type)`.

### `email_send_failures` table

Records failures at send time (Resend rejected the API call, or the batch request itself failed).

| Column        | Type          | Notes                                                                                 |
| ------------- | ------------- | ------------------------------------------------------------------------------------- |
| `id`          | `uuid`        | Primary key, default `gen_random_uuid()`                                              |
| `client_id`   | `uuid`        | Foreign key → `clients.id`                                                            |
| `email`       | `text`        |                                                                                       |
| `context`     | `text`        | `postclinic_vaccine`, `postclinic_booster`, `reminder_2w`, `reminder_1w`, or `manual` |
| `event_date`  | `date`        | Optional — clinic date, if applicable                                                 |
| `clinic_type` | `text`        | Optional                                                                              |
| `error`       | `text`        |                                                                                       |
| `created_at`  | `timestamptz` | Default `now()`                                                                       |

### `email_events` table

Records bounces, complaints, and other delivery events reported later via the Resend webhook.

| Column            | Type          | Notes                                                                                          |
| ----------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `id`              | `uuid`        | Primary key, default `gen_random_uuid()`                                                       |
| `resend_email_id` | `text`        |                                                                                                |
| `event_type`      | `text`        | `delivered`, `bounced`, `complained`, `delivery_delayed`, `opened`, or `clicked`               |
| `client_id`       | `uuid`        | Foreign key → `clients.id`; resolved via `resend_email_id` lookup against the log tables above |
| `email`           | `text`        |                                                                                                |
| `raw_payload`     | `jsonb`       | Full webhook payload, for debugging                                                            |
| `created_at`      | `timestamptz` | Default `now()`                                                                                |

---

## RLS Policies

Row Level Security is enabled on all tables.

| Table                  | Role                    | Permissions                    |
| ---------------------- | ----------------------- | ------------------------------ |
| `clients`              | `anon`                  | INSERT, SELECT, UPDATE         |
| `clients`              | `authenticated`         | SELECT, UPDATE, DELETE         |
| `pets`                 | `anon`                  | INSERT, SELECT, UPDATE         |
| `pets`                 | `authenticated`         | SELECT, UPDATE, DELETE         |
| `vaccinations`         | `anon`                  | SELECT                         |
| `vaccinations`         | `authenticated`         | INSERT, SELECT, UPDATE, DELETE |
| `events`               | `authenticated`         | INSERT, SELECT, UPDATE, DELETE |
| `vaccine_waste`        | `authenticated`         | INSERT, SELECT                 |
| `queue_state`          | `anon`                  | SELECT                         |
| `queue_state`          | `authenticated`         | SELECT, UPDATE                 |
| `email_templates`      | `authenticated`         | SELECT, UPDATE                 |
| `triggers`             | `anon`, `authenticated` | SELECT, INSERT, UPDATE, DELETE |
| `postclinic_email_log` | `anon`, `authenticated` | SELECT, INSERT                 |
| `reminder_email_log`   | `anon`, `authenticated` | SELECT                         |
| `email_send_failures`  | `anon`, `authenticated` | SELECT                         |
| `email_events`         | `anon`, `authenticated` | SELECT                         |

> ⚠️ `reminder_email_log`, `email_send_failures`, and `email_events` are written to exclusively by serverless functions using the Supabase service-role key, which bypasses RLS — they intentionally have no INSERT policy for `anon`/`authenticated`.

---

## Supabase Storage

Create a storage bucket named `templates` and set it to **public**. Upload:

- `RabiesVacCert.pdf` — the NASPHV Form 51 template
- `ana_signature.png` — the veterinarian's signature image

A second, **private** bucket named `attachments` stores client/pet document uploads (see `attachments` table, referenced from `client.html` and `discharge.html`). Files are served via short-lived (5-minute) signed URLs generated on demand.

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

### Dependencies

The `api/` serverless functions have npm dependencies (currently just `svix`, for verifying Resend webhook signatures). Install with:

```bash
npm install
```

`node_modules/` is gitignored — Vercel installs dependencies fresh from `package.json` on every deploy.

### Environment Variables (Vercel)

| Variable                    | Used by                                           |
| --------------------------- | ------------------------------------------------- |
| `SUPABASE_URL`              | All serverless functions                          |
| `SUPABASE_ANON_KEY`         | Frontend (via `config.js`)                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverless functions needing to bypass RLS        |
| `DEEPL_API_KEY`             | `api/translate.js`                                |
| `RESEND_API_KEY`            | `api/send-postclinic.js`, `api/send-reminders.js` |
| `RESEND_WEBHOOK_SECRET`     | `api/webhooks/resend.js`                          |
| `VET_LICENSE_ANA`           | Certificate generation                            |
| `VET_LICENSE_FRIEDMAN`      | Certificate generation                            |

### Running locally

No build step required for the frontend. Create `config.js` as described above, then open any `.html` file in a browser or use VS Code's **Live Preview** extension.

Since most pages depend on Supabase for data, full functionality requires a live internet connection and valid credentials. Serverless functions under `api/` require `vercel dev` to run locally.

---

## Certificate Generation

Rabies certificates are generated entirely in the browser using [pdf-lib](https://pdf-lib.js.org/). Breed and colors/markings are translated to English via DeepL first if needed. The filled PDF is downloaded directly — no server required for the PDF itself.

---

## Built with

- Plain HTML, CSS, and JavaScript on the frontend — no framework
- [Supabase](https://supabase.com) — Postgres database, REST API, Auth, and Storage
- [Vercel](https://vercel.com) — hosting + serverless functions (free tier)
- [Resend](https://resend.com) — transactional email, with batch sending and signed webhooks
- [svix](https://www.npmjs.com/package/svix) — webhook signature verification
- [pdf-lib](https://pdf-lib.js.org/) — in-browser PDF form filling
- [Signature Pad](https://github.com/szimek/signature_pad) — drawn signature capture
- [DeepL](https://www.deepl.com/) (free tier) — Spanish → English translation for certificates
- [Google Fonts](https://fonts.google.com) — Nunito + Nunito Sans

---

## Known Limitations

- Maximum of 3 pets per registration on the public intake form
- Client upsert matches by email or phone — names alone are not deduplicated
- No server-side validation; all validation is client-side
- Waiver signature is only captured via the public intake form — walk-in registrations do not currently collect a signature
- Queue numbers are manually managed; no automatic tie to check-in order
- `email_templates` has no INSERT policy — saving a **brand-new** trigger template ID via the Triggers UI's upsert may silently fail; only updates to existing template IDs are guaranteed to persist
- Resend webhook events cannot be backfilled — bounce/complaint data only exists for emails sent after the webhook was configured
