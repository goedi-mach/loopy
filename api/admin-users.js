// api/admin-users.js
// Vercel serverless function — handles Supabase admin user operations (admin only).
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Optional: SITE_URL (where invite links land).

import { requireRole } from './_auth.js';

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL         = (process.env.SITE_URL || 'https://clinic.phpchi.org').replace(/\/+$/, '');
const REDIRECT_TO      = `${SITE_URL}/set-password`;

const ROLES    = ['volunteer', 'staff', 'admin'];
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Admin fetch helper (uses service role key) ────────────────
async function adminFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.message || data.error_description || 'Supabase admin error');
  return data;
}

// Every user, not just the first page.
async function listAllUsers() {
  const users = [];
  for (let page = 1; page <= 20; page++) {
    const data  = await adminFetch(`admin/users?page=${page}&per_page=200`);
    const batch = data.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

function audit(caller, action, details) {
  console.log(JSON.stringify({ audit: 'admin-users', by: caller.user?.email || caller.user?.id, action, ...details }));
}

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admins only.
  const caller = await requireRole(req, res, ['admin']);
  if (!caller) return;

  try {
    // ── GET: list all users ──────────────────────────────────
    if (req.method === 'GET') {
      const users = await listAllUsers();
      return res.status(200).json({ users });
    }

    // ── POST: invite | set_role | resend_invite ──────────────
    const { action, email, role, userId } = req.body || {};

    // Invite a new user
    if (action === 'invite') {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'A valid email is required' });
      if (!ROLES.includes(role))      return res.status(400).json({ error: 'Role must be volunteer, staff or admin' });

      const data = await adminFetch(`invite?redirect_to=${encodeURIComponent(REDIRECT_TO)}`, {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, data: { role } })
      });

      // The role that actually counts lives in app_metadata (the user can't edit it).
      try {
        await adminFetch(`admin/users/${data.id}`, {
          method: 'PUT',
          body: JSON.stringify({ app_metadata: { role } })
        });
      } catch (e) {
        return res.status(500).json({
          error: `The invite email was sent to ${cleanEmail}, but their role could not be set (${e.message}). Find them in the list and use Change role.`
        });
      }

      audit(caller, 'invite', { email: cleanEmail, role });
      return res.status(200).json({ success: true });
    }

    // Change an existing user's role
    if (action === 'set_role') {
      if (!UUID_RE.test(String(userId || ''))) return res.status(400).json({ error: 'A valid userId is required' });
      if (!ROLES.includes(role))                return res.status(400).json({ error: 'Role must be volunteer, staff or admin' });

      // Never let the last admin be demoted (that would lock everyone out of user management).
      if (role !== 'admin') {
        const users = await listAllUsers();
        const otherAdmins = users.filter(u => u.id !== userId && u.app_metadata?.role === 'admin');
        if (!otherAdmins.length) {
          return res.status(400).json({ error: 'There must always be at least one other admin. Make someone else an admin first.' });
        }
      }

      await adminFetch(`admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ app_metadata: { role } })
      });

      audit(caller, 'set_role', { userId, role });
      return res.status(200).json({ success: true });
    }

    // Resend invite email to an existing user
    if (action === 'resend_invite') {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'A valid email is required' });

      await adminFetch(`invite?redirect_to=${encodeURIComponent(REDIRECT_TO)}`, {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail })
      });

      audit(caller, 'resend_invite', { email: cleanEmail });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}