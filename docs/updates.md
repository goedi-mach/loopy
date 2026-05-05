# Pawkit — Updates

## Week of April 27 – May 5, 2026

---

### Spanish → English Translation for Rabies Certificates

Because the intake form is bilingual, clients were submitting breed and color/markings in Spanish — but the NASPHV Form 51 rabies certificate is a legal document that requires English. Translation is now automatic.

**How it works:**
- When a rabies vaccine is selected in `discharge.html`, the pre-filled **Colors / Markings** and **Breed** fields are passed through a DeepL translation call if they contain non-ASCII characters
- Staff see the translated value in a green-tinted field with a "✓ Translated from Spanish" status note
- The field becomes editable so staff can correct the translation if needed
- If translation is unavailable, a warning prompts staff to review manually

**New files:**
- `api/translate.js` — Vercel serverless function that proxies requests to DeepL's free-tier API (`api-free.deepl.com`), keeping the API key server-side
- `DEEPL_API_KEY` added as a Vercel environment variable

**New discharge fields:**
- **Breed (for certificate)** — visible, editable field in the NASPHV section showing the English breed value that will be written to the PDF
- `breed_en` column added to the `vaccinations` table to store the English breed at time of logging
- Certificate generation updated to use `breed_en` with fallback to `pet.breed`

---

### Merge Clients Tool

A new staff page (`merge-clients.html`) for resolving duplicate client records, modeled after Salesforce's merge UI.

**How it works:**
- Search for and select two clients (Client A and Client B)
- Records are shown side by side with field-by-field comparison
- Staff choose which value to keep for each field (name, phone, email, address)
- On merge: pets and vaccination records are reassigned to the surviving client; the duplicate is archived
- UUID-safe onclick handling (client IDs are quoted strings in generated HTML)

---

### File Attachments

Staff and volunteers can now upload documents to client records directly from `discharge.html` and `client.html`.

**How it works:**
- Files are stored in a private Supabase Storage bucket (`attachments`), organized by client ID
- Signed URLs (5-minute expiry) are generated on demand for secure viewing
- Upload and delete are available from both discharge and the client profile
- A new `attachments` table tracks metadata: `client_id`, `pet_id` (optional), `storage_path`, `display_name`, `uploaded_by`

---

### Post-Clinic Bug Fixes (May 5 clinic follow-up)

Several issues surfaced after the most recent clinic and were resolved:

**Lot number fixes:**
- Multiple active lots per vaccine type are now fully supported — previously, reactivating a second FVRCP lot could fail if one was already active
- The discharge form now shows a dropdown when multiple active lots exist for the same vaccine type
- Lot number corrections made after selecting a vaccine were not being saved on submit — fixed; the field now correctly updates before the payload is built

**Vaccination history:**
- Rabies tag number was not appearing in the vaccination history table — it was reading from `serial_number` instead of `rabies_tag_number`; fixed with a fallback: `r.rabies_tag_number || r.serial_number`

**Client address on rabies certificate:**
- Client address was appearing blank on the rabies certificate even when it was saved on the profile
- Root cause: `discharge.html` was loading the client object from the search results, which only selected a subset of columns; the structured address fields (`street`, `city`, `state`, `zip`) were not included
- Fixed by ensuring all address fields are fetched and passed into the certificate generation function

**Client profile card layout (`client.html`):**
- Attendance, Pets, and Documents cards were rendering inside a shared white background panel instead of as independent floating cards
- Caused by a stray extra `</div>` after the `.main` closing tag; removed

---

### Walk-in Form — Close Button

The walk-in registration panel in `intake.html` had no way to close without refreshing the page. A close (✕) button has been added to the card header, which calls the existing `closeWalkin()` function.

---

### Vaccine Rename: DAPP + Lepto → Lepto

All references to "DAPP + Lepto" have been renamed to "Lepto" throughout the app and database.

**Changes:**
- `discharge.html` — vaccine label updated in `VACCINE_OPTIONS`
- `staff-home.html` — lot management dropdown and `VAX_LABELS` display map updated
- `vaccinations` table — all `"DAPP + Lepto 1 Year"` rows renamed to `"Lepto 1 Year"`, `"DAPP + Lepto 4 Weeks"` renamed to `"Lepto 4 Weeks"` via SQL migration
- `vaccine_waste` table — `"DAPP + Lepto"` rows renamed to `"Lepto"`

---

### Sandbox Environment

A sandbox deployment (`pawkit-sandbox.vercel.app`) is now available for testing without affecting real clinic data.

- All pages with the sandbox hostname display a persistent coral banner: "🧪 SANDBOX — This is a test environment. No real data will be affected." with a link back to production
- The `?` help menu on `discharge.html` includes a "🧪 Try Sandbox" button

---

### User Guide

A staff user guide document (`Pawkit_User_Guide.docx`) was created covering the full clinic workflow: intake, discharge, vaccination logging, certificate download, and reporting. Formatted as a printable reference with space for screenshots.

An intake quick-reference card (`Pawkit_Intake_Quick_Ref.docx`) was also created — a single-page scannable guide for the intake station covering pre-registered clients, walk-ins, status badges, and quick actions.

---

### Vet License Numbers

Vet license numbers for Dr. Ana Valbuena and Dr. Alexandra Friedman are now injected via environment variables (`VET_LICENSE_ANA`, `VET_LICENSE_FRIEDMAN`) rather than hardcoded in the certificate generation logic.

- `scripts/build-config.js` updated to include both values in the generated `config.js`
- `discharge.html` and `client.html` updated to read from `CONFIG.VET_LICENSE_ANA` and `CONFIG.VET_LICENSE_FRIEDMAN`

---

## Previously (Week of April 21–27, 2026)

### Automated Vaccine Reminders

- Bilingual (English/Spanish) reminder emails sent at 2 weeks and 1 week before a pet's `next_due` date via Resend
- Booster-specific email path references the next upcoming Booster Clinic date from the `events` table
- Cron runs daily at 10am UTC via Vercel Cron Jobs (`api/send-reminders.js`)
- Duplicate sends prevented by `reminder_2w_sent` and `reminder_1w_sent` flags on `vaccinations`
- Email consent clause added to the bilingual intake waiver

### `events` Table

- `notes` column renamed to `clinic_type` — all references in `staff-home.html` updated accordingly

### Booster Clinic Mode

- When today's event is a Booster Clinic, the discharge page defaults to "In Queue" filter and loads clients from the most recent completed Vaccine Clinic date

### Mobile Assessment

- Staff-facing pages (navigation overflow on small screens, data-heavy tables in discharge and records, complex discharge workflows) identified as the primary areas needing mobile work — scoped but not yet implemented