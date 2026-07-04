## Week of June 29 – July 4, 2026

---

### Email Reliability: Batch Sending, Failure Tracking & Bounce Monitoring

Post-clinic and reminder emails previously sent one at a time via Resend's single-send endpoint, with a manual sleep delay to stay under rate limits. A single failed send could also halt an entire reminder run. Both are now fixed.

**Batch sending:**

- `api/send-postclinic.js` and `api/send-reminders.js` migrated to Resend's `/emails/batch` endpoint (up to 100 emails per API call)
- One failed batch call no longer blocks remaining sends — failures are caught and logged per-batch instead of aborting the whole run

**Failure & bounce tracking (new):**

- `email_send_failures` table — records failures at send time (bad address, Resend API errors)
- `email_events` table — records bounces, complaints, and delivery events reported after the fact by Resend
- `reminder_email_log` table — new send log for reminder emails, mirroring `postclinic_email_log`
- `resend_email_id` column added to `postclinic_email_log` to correlate webhook events back to the original send
- New signed webhook endpoint, `api/webhooks/resend.js`, verifies Resend's Svix-signed payloads and logs delivery/bounce/complaint events in real time
- New **"Failures" tab** in the Reminder Manager (`tools/reminders.html`) surfaces both send failures and bounces/complaints without needing direct database access

**New dependency:** `svix` (npm), added via a new project-root `package.json` — this is the project's first npm dependency, so `node_modules/` was added to `.gitignore`.

---

### Sandbox Environment Decommissioned

The sandbox deployment (`pawkit-sandbox.vercel.app`) had drifted out of sync with production and was no longer being maintained. Rather than continue paying the maintenance cost of keeping schema changes mirrored across two environments, it's been fully decommissioned.

- Sandbox banner script removed from all 14 affected pages
- "🧪 Try Sandbox" button removed from the `?` help menu on `intake.html` and `discharge.html`
- Sandbox Supabase project and Vercel deployment both deleted

Can be rebuilt from scratch later if the need for a dedicated test environment comes back.

---

### Password Field Improvements

Login and password-set screens across the app now have:

- An eye icon toggle to show/hide the typed password
- A Caps Lock warning that appears while the password field is focused and Caps Lock is active

Applied to `login.html`, `client.html`, `discharge.html`, `intake.html`, `records.html`, `reports.html`, and `set-password.html`.

---

### Intake Form: Missing Field Fix

The "Add Pet" form in `intake.html` was missing the **Colors / Markings** field, even though it existed on the walk-in registration form and the client profile's edit form. Pets added via `intake.html` since that gap opened may be missing this field — added now for consistency across all three entry points.
