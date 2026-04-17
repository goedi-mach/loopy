# People Helping Pets — PHP Clinic App

Internal web tools for running free vaccine clinics. Built for [People Helping Pets](https://peoplehelpingpets.org), a Chicago-based nonprofit providing bilingual vaccine clinics for cats and dogs in underserved neighborhoods.

---

## Pages

| File                   | Purpose                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `index.html`           | Landing / home page                                                                              |
| `intake.html`          | Bilingual client & pet registration form (English/Spanish) with waiver and drawn signature       |
| `dashboard.html`       | Role-selector landing page — routes staff to the appropriate tool                                |
| `intake-staff.html`    | Staff intake tool — client search, walk-in registration, check-in, pet records                   |
| `discharge-staff.html` | Staff discharge tool — vaccine logging, microchip, certificate download, mark as seen            |
| `records.html`         | Sortable, filterable table of all clients and pets; CSV export                                   |
| `client.html`          | Client profile page — edit client/pet records, vaccination history, cert download, signed waiver |

---

## Certificate Generation

Rabies certificates (NASPHV Form 51) are generated entirely in the browser using [pdf-lib](https://pdf-lib.js.org/). The filled PDF is downloaded directly — no server required.

The template PDF (`RabiesVacCert.pdf`) and the veterinarian signature image (`ana_signature.png`) are hosted in Supabase Storage under the `templates` bucket and must be publicly accessible.

A standalone Python script (`fill_cert.py`) also exists for local CLI-based certificate generation. It requires `pypdf`, `requests`, `python-dateutil`, and `reportlab`. Run it with:

```bash
python fill_cert.py <vaccination_id>
```

Output is saved to `certificates/cert_<vaccination_id>.pdf`.

---

## Waiver & Signature

The public intake form (`intake.html`) includes a bilingual liability waiver (English/Spanish) that clients must sign before submitting. The signature is drawn on a canvas using [Signature Pad](https://github.com/szimek/signature_pad) and saved as a base64 PNG string.

On submission, two fields are written to the `clients` table:

- `waiver_signature` — base64 PNG of the drawn signature
- `waiver_signed_at` — UTC timestamp of submission

The signed waiver is viewable by staff on the client's profile page (`client.html`), which displays the signature image and the date/time it was signed.

---

## Setup

### 1. Supabase

This project uses [Supabase](https://supabase.com) as its backend (Postgres via REST API, Supabase Auth for staff login).

**`clients` table**

| Column             | Type          | Notes                                                                               |
| ------------------ | ------------- | ----------------------------------------------------------------------------------- |
| `id`               | `uuid`        | Primary key, default `gen_random_uuid()`                                            |
| `name`             | `text`        | Required                                                                            |
| `email`            | `text`        | Optional                                                                            |
| `phone`            | `text`        | Optional                                                                            |
| `street`           | `text`        | Optional — replaces old single `address` field                                      |
| `city`             | `text`        | Optional                                                                            |
| `state`            | `text`        | Optional                                                                            |
| `zip`              | `text`        | Optional                                                                            |
| `address`          | `text`        | Legacy — kept for backward compatibility; use `street/city/state/zip` going forward |
| `event_date`       | `date`        | Set automatically on submission                                                     |
| `status`           | `text`        | `registered`, `checked_in`, or `seen`                                               |
| `checked_in_at`    | `timestamptz` | Optional                                                                            |
| `seen_at`          | `timestamptz` | Optional                                                                            |
| `archived`         | `bool`        | Default `false`                                                                     |
| `waiver_signature` | `text`        | Base64 PNG of drawn signature; set on intake form submission                        |
| `waiver_signed_at` | `timestamptz` | UTC timestamp of waiver signature; set on intake form submission                    |
| `created_at`       | `timestamptz` | Default `now()`                                                                     |

**`pets` table**

| Column             | Type          | Notes                                    |
| ------------------ | ------------- | ---------------------------------------- |
| `id`               | `uuid`        | Primary key, default `gen_random_uuid()` |
| `client_id`        | `uuid`        | Foreign key → `clients.id`               |
| `name`             | `text`        | Required                                 |
| `species`          | `text`        | `dog`, `cat`, `ferret`, or `other`       |
| `breed`            | `text`        | Optional                                 |
| `age`              | `float8`      | Optional, in years                       |
| `age_unit`         | `text`        | `years` or `months`                      |
| `weight`           | `float8`      | Optional, in lbs                         |
| `sex`              | `text`        | `male`, `female`, or `unknown`           |
| `altered`          | `text`        | `yes`, `no`, or `unknown`                |
| `microchipped`     | `text`        | `yes`, `no`, or `unknown`                |
| `microchip_number` | `text`        | Optional                                 |
| `colors_markings`  | `text`        | Optional                                 |
| `archived`         | `bool`        | Default `false`                          |
| `created_at`       | `timestamptz` | Default `now()`                          |

**`vaccinations` table**

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

### 2. RLS Policies

Row Level Security is enabled on all tables. The following policies are required:

**`clients`**

- `anon`: INSERT, SELECT, UPDATE
- `authenticated`: SELECT, UPDATE

**`pets`**

- `anon`: INSERT, SELECT, UPDATE
- `authenticated`: SELECT, UPDATE

**`vaccinations`**

- `anon`: SELECT
- `authenticated`: INSERT, SELECT, UPDATE, DELETE

### 3. Supabase Storage

Create a storage bucket named `templates` and set it to **public**. Upload:

- `RabiesVacCert.pdf` — the NASPHV Form 51 template
- `ana_signature.png` — the veterinarian's signature image

### 4. Configure credentials

Credentials are managed via `config.js`, which is gitignored and generated at build time by `scripts/build-config.js` using Vercel environment variables.

For local development, create `config.js` manually in the project root:

```js
const CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-key-here",
};
```

Both values are found in your Supabase project under **Settings → API**.

For `fill_cert.py`, set the same values near the top of the script:

```python
SUPABASE_URL = "https://your-project-id.supabase.co"
SUPABASE_KEY = "your-anon-or-service-key"
```

> ⚠️ Never commit `config.js` or real credentials to the repository.

---

## Running locally

No build step required. Create `config.js` as described above, then open any `.html` file in a browser or use VS Code's **Live Preview** extension for a local dev server with auto-reload.

For `fill_cert.py`, install dependencies first:

```bash
pip install pypdf requests python-dateutil reportlab
```

---

## Built with

- Plain HTML, CSS, and JavaScript — no frameworks, no npm
- [Supabase](https://supabase.com) — Postgres database, REST API, Auth, and Storage
- [pdf-lib](https://pdf-lib.js.org/) — in-browser PDF form filling for certificates
- [Signature Pad](https://github.com/szimek/signature_pad) — drawn signature capture on the intake form
- [pypdf](https://pypdf.readthedocs.io/) + [reportlab](https://www.reportlab.com/) — Python-based certificate generation (CLI)
- [Google Fonts](https://fonts.google.com) — Nunito + Nunito Sans
- [Vercel](https://vercel.com) — hosting (free tier)

---

## Known limitations

- Maximum of 3 pets per registration on the public intake form
- Client upsert matches by email or phone — names alone are not deduplicated
- No server-side validation; all validation is client-side
- The `fill_cert.py` script is CLI-only and not wired into the app UI
- Waiver signature is only captured via the public intake form — walk-in registrations through `intake-staff.html` do not currently collect a signature
