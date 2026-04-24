# Pawkit — Product Update

**April 23, 2026**

---

## What's New

### 🗑️ Vaccine Waste Tracking

Staff can now log vaccines that were drawn or pulled but not used at the end of each clinic event. When closing an event in Staff Home, a modal prompts staff to enter waste by vaccine type (Rabies, DAPP, DAPP + Lepto, FVRCP) and dose count. This data is stored per event and surfaced in the Reports page so PHP can track supply usage over time — useful for grant reporting and inventory planning.

### 📝 Permanent Client Notes

A sticky notes pill now appears on the client card in Intake and Discharge whenever a client is loaded. Staff can click the 📝 button to expand a textarea, write a note, and save it. Notes are permanent — they follow the client across all future clinic visits. The full notes field also appears on the Client Profile page. Examples: "needs Spanish," "always brings two dogs," "elderly owner, needs extra time."

### 📺 Queue Display Screen (`queue-display.html`)

A new public-facing display page designed to run on a TV or tablet visible to the waiting crowd. Shows the currently serving ticket numbers in large, bold type with the next batch of numbers below. Auto-refreshes every 10 seconds. No login required. Built for PHP's May 3rd outdoor clinic — clients wait in the yard and are called inside by number, DMV/deli style.

### 🎛️ Queue Control Panel (`queue-control.html`)

A staff-only control page for managing the queue display. Shows the current batch of numbers being served with Next and Back buttons (advances in batches of 3). Includes a Reset button to start back at #1 for a new event. Linked from Staff Home as a nav tile.

### 🎟️ Floating Queue Widget (Intake page)

The queue controls are also available directly on the Intake page as a collapsible floating bubble — a small 🎟️ emoji that expands into a pill with Next and Back buttons when clicked. Staff can manage the queue without leaving the intake workflow. The widget syncs with the display screen in real time.

### 📅 Clinic Banner Fix

The active clinic banner on Intake and Discharge now correctly shows the event name, location, and time when a clinic is scheduled for today. Previously it was always visible (even when empty) due to a CSS conflict. Now it only appears when there's an actual event.

---

## Infrastructure Changes

### New Supabase Tables

- **`vaccine_waste`** — stores per-event vaccine waste entries (event, vaccine type, dose count, logged by)
- **`queue_state`** — single-row table storing the current queue number; shared between the display screen and control panel in real time

### Schema Addition

- **`clients.notes`** (`text`) — new column for permanent free-text client notes

### New RLS Policies

- `vaccine_waste`: authenticated users can insert and read
- `queue_state`: anon can read (for the display screen); authenticated can update (for the control panel)
- `clients`: anon can read (for the queue display page)

---

## Files Added

- `queue-display.html` — crowd-facing queue number display
- `queue-control.html` — staff queue control panel

## Files Updated

- `staff-home.html` — event close flow now includes vaccine waste modal; Queue Control tile added
- `intake.html` — client notes pill; floating queue widget; clinic banner fix
- `discharge.html` — clinic banner fix
- `reports.html` — vaccine waste section added

## Files Removed

- `queue.html` — replaced by `queue-display.html` and `queue-control.html`
- `queue-dj.html` — superseded by the new queue system
