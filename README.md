# People Helping Pets — Clinic Tools

Internal web tools for running free vaccine clinics. Built for [People Helping Pets](https://peoplehelpingpets.org), a Chicago-based nonprofit providing bilingual vaccine clinics for cats and dogs in underserved neighborhoods.

---

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Landing / home page |
| `intake.html` | Bilingual client & pet registration form (English/Spanish) |
| `dashboard.html` | Staff dashboard for viewing and managing registrations |

---

## Setup

### 1. Supabase

This project uses [Supabase](https://supabase.com) as its backend. You'll need a Supabase project with two tables.

**`clients` table**

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `name` | `text` | Required |
| `email` | `text` | Optional |
| `phone` | `text` | Optional |
| `address` | `text` | Optional |
| `event_date` | `date` | Set automatically on submission |
| `created_at` | `timestamptz` | Default `now()` |

**`pets` table**

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `client_id` | `uuid` | Foreign key → `clients.id` |
| `name` | `text` | Required |
| `species` | `text` | `dog` or `cat` |
| `breed` | `text` | Optional |
| `age` | `int4` | Optional, in years |
| `weight` | `float8` | Optional, in lbs |
| `sex` | `text` | `male`, `female`, or `unknown` |
| `altered` | `text` | `yes`, `no`, or `unknown` |
| `microchipped` | `text` | `yes`, `no`, or `unknown` |
| `microchip_number` | `text` | Optional |
| `created_at` | `timestamptz` | Default `now()` |

### 2. Configure credentials

At the top of `intake.html` and `dashboard.html`, replace the placeholder values with your own Supabase project URL and anon key:

```js
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

Both values are found in your Supabase project under **Settings → API**.

> ⚠️ The anon key in these files is currently hardcoded. This is fine for a private internal tool, but avoid committing real credentials to a public repository. Consider using environment variables or a config file excluded via `.gitignore` if this repo ever becomes public.

---

## Running locally

No build step required. Open any `.html` file directly in a browser, or use VS Code's **Live Preview** extension for a local dev server with auto-reload.

---

## Built with

- Plain HTML, CSS, and JavaScript — no frameworks, no npm
- [Supabase](https://supabase.com) — database and REST API
- [Google Fonts](https://fonts.google.com) — Nunito + Nunito Sans

---

## Known limitations

- Maximum of 3 pets per registration (intake form)
- Client matching on upsert is done by email or phone — names alone are not deduplicated
- No server-side validation; all validation is client-side in the browser
- Supabase credentials are hardcoded in each HTML file (see note above)
