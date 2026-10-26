# Loopy — People Helping Pets

Clinic management web app for [People Helping Pets](https://peoplehelpingpets.org), a Chicago nonprofit that runs free bilingual (English/Spanish) vaccine clinics for cats and dogs in underserved neighborhoods.

Loopy covers the whole clinic day and what comes after: client and pet registration, vaccine and microchip logging, rabies certificates, event close-out, follow-up and reminder emails, and reporting.

---

## Tech stack

| Layer                   | Tool                                                                          |
| ----------------------- | ----------------------------------------------------------------------------- |
| Frontend                | React 19 + TypeScript, built with Vite (`clinic-web/`)                        |
| Routing                 | React Router                                                                  |
| Database, auth, storage | [Supabase](https://supabase.com) (Postgres + RLS, Auth, Storage)              |
| Hosting + backend       | [Vercel](https://vercel.com) (static site + serverless functions in `api/`)   |
| Email                   | [Resend](https://resend.com), with signed webhooks verified by `svix`         |
| Translation             | DeepL (free tier), used for Spanish breed/color fields on rabies certificates |
| PDFs                    | `pdf-lib` (certificates and waivers, generated in the browser)                |
| Signatures              | `signature_pad` (waiver capture)                                              |

---

## Repository layout

```
clinic-web/          React app (src/, public/, Vite config)
api/                 Vercel serverless functions
  _auth.js             shared login/role check for protected endpoints
  admin-users.js       invite, list, and set roles for users (admin only)
  send-postclinic.js   post-clinic follow-up emails
  send-reminders.js    daily reminder run (cron)
  send-reminder-manual.js  manual reminder sends from the Reminders tool
  translate.js         DeepL proxy for certificates
  webhooks/resend.js   Resend delivery/bounce/complaint events
supabase/
  migrations/          schema changes, in order
  schema.sql           schema snapshot (see note under Database)
docs/                  user guide PDF, update log, feedback notes
.github/workflows/     build check, Supabase keep-alive
vercel.json            build settings, redirects, SPA rewrite, cron
package.json           root dependencies for the serverless functions (svix)
```

---

## Pages and roles

Sign-in uses Supabase Auth. Each user has a role in their JWT (`app_metadata.role`): **volunteer**, **staff**, or **admin**.

| Route                      | Who          | Purpose                                                                                                           |
| -------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `/`                        | everyone     | Landing page                                                                                                      |
| `/registration`            | public       | Bilingual client and pet registration with waiver signature                                                       |
| `/login`, `/set-password`  | everyone     | Sign-in and invite password setup                                                                                 |
| `/clinic`                  | signed in    | Single clinic-day page: walk-ins, check-in, vaccine and microchip logging, print-record links, attendance history |
| `/client/:id`              | signed in    | Client profile: inline editing, vaccination history, waiver PDF, certificates                                     |
| `/client/:id/print/:petId` | signed in    | Printable pet record                                                                                              |
| `/records`                 | signed in    | Searchable client and pet database                                                                                |
| `/reports`                 | staff, admin | Analytics (vaccines, species, ZIP demographics, return rates, waste)                                              |
| `/staff-home`              | staff, admin | Events, vaccine lot inventory, clinic stats                                                                       |
| `/tools/reminders`         | staff, admin | Email templates, triggers, manual sends, failures and bounces                                                     |
| `/tools/batch-certs`       | staff, admin | Generate rabies certificates in bulk                                                                              |
| `/tools/merge-clients`     | staff, admin | Merge duplicate client records                                                                                    |
| `/tools/user-management`   | admin        | Invite users and set roles                                                                                        |

`/intake` and `/discharge` redirect to `/clinic`. The old `/volunteer-home` page was removed; volunteers now land on `/clinic` after signing in, and old links redirect there. Old `.html` URLs (for example `/records.html`) redirect to their React routes.

---

## Key features

- **Public registration** through the `register_visit` database function, so the public form needs no direct table access.
- **Duplicate-aware client handling**, with accent-insensitive search (`unaccent`) and a merge tool.
- **Rabies certificates** (NASPHV Form 51) generated in the browser from a template in Supabase Storage.
- **Event close-out** that prompts for vaccine waste before an event is finalized.
- **Vaccine lot inventory** with expiration tracking.
- **Email system**: post-clinic follow-ups and reminders sent in batches through Resend, with per-send failure logging, bounce/complaint tracking from webhooks, and a dynamic trigger system (microchip status, intact pets, ZIP code, upcoming due dates).
- **Reminder cron** runs daily at 10:00 UTC (see `vercel.json`).

---

## Database

Schema changes live in `supabase/migrations/`. Apply new ones to the **live** project deliberately; there is a separate dev project for testing.

> `supabase/schema.sql` is a snapshot taken before the October 2026 access lockdown, so it still shows the old anonymous policies. The migration `20261024000000_close_anon_access.sql` records that lockdown. Use the live database, or the migrations, as the source of truth.

### Row Level Security

RLS is enabled on every table.

- **Anonymous visitors** can only call `register_visit` (the public registration form) and read `events`. They have no direct access to `clients`, `pets`, `vaccinations`, or any email table.
- **Signed-in users** read and write clinic data according to their role. Deleting clients and pets is admin-only.
- **Email and trigger tables** (`email_events`, `email_send_failures`, `postclinic_email_log`, `reminder_email_log`, `triggers`) are readable only by signed-in users. Writes come from serverless functions using the service-role key, which bypasses RLS.
- The `pet_next_due` view runs with the caller's permissions (`security_invoker`).

### Storage

A public bucket named `templates` holds `RabiesVacCert.pdf` (the NASPHV Form 51 template) and `ana_signature.png` (the veterinarian signature). Both are fetched by the browser when a certificate is generated.

---

## Local development

Requires Node 20+.

```
cd clinic-web
npm install
npm run dev
```

Create `clinic-web/.env.local` (gitignored):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_VET_LICENSE_VALBUENA=<license number shown on certificates>
```

Use the **dev** Supabase project's values for local work. Other scripts: `npm run build` (type-check and build), `npm run lint`, `npm run preview`.

The `api/` functions only run on Vercel (or with `vercel dev`).

---

## Deployment

Pushing to `main` deploys through Vercel. `vercel.json` installs and builds `clinic-web/`, serves `clinic-web/dist`, rewrites every non-`/api` path to the SPA, and registers the daily reminder cron.

GitHub Actions run a build check on every pull request and push to `main`, plus a twice-weekly keep-alive ping so the free-tier Supabase project doesn't pause.

### Environment variables (Vercel)

| Variable                                      | Used by                                            |
| --------------------------------------------- | -------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | React app (public by design; protected by RLS)     |
| `VITE_VET_LICENSE_VALBUENA`                   | Certificate generation                             |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`   | Serverless functions (never expose to the browser) |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`     | Email sending and webhook verification             |
| `CRON_SECRET`                                 | Authorizes the scheduled reminder run              |
| `DEEPL_API_KEY`                               | Certificate translation                            |
| `SITE_URL`                                    | Where invite links land                            |

---

## Previous version

Loopy began as a vanilla HTML/CSS/JavaScript site (one page per tool, `config.js` generated at build time). It was replaced by the React app in October 2026. The last version of that site is preserved in the Git tag **`live-before-migration`**.

To use it as a fallback you would need more than the code. The old pages talked to the database as the anonymous role, and that access was closed on Oct 24, 2026. A rollback means re-creating the old anonymous policies on `clients`, `pets`, and `vaccinations`, and restoring the old build variables (`SUPABASE_ANON_KEY`, `VET_LICENSE_VALBUENA`). Only do that deliberately, since it reopens public read access to client data.

---

## Known limitations

- Registration allows up to 3 pets per visit.
- Validation is mostly client-side; the database and `register_visit` enforce the essentials.
- Barcode scanning for vaccine vials, annual renewal reminders, and spay clinic support are planned but not built yet.
