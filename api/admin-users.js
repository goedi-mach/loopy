// api/admin-users.js
// Vercel serverless function — handles all Supabase admin user operations.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as Vercel environment variables.

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;

async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing token');
  const token = authHeader.slice(7);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Invalid or expired token');

  const user = await res.json();
  const role = user.app_metadata?.role || 'volunteer';
  if (role !== 'admin') throw new Error('Forbidden: admin only');
}

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
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.message || 'Supabase admin error');
  return data;
}

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers (in case you ever call this from a different origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await verifyAdmin(req.headers.authorization);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  try {
    // ── GET: list all users ──────────────────────────────────
    if (req.method === 'GET') {
      const data = await adminFetch('admin/users?per_page=200');
      return res.status(200).json({ users: data.users });
    }

    // ── POST: invite | set_role ──────────────────────────────
    if (req.method === 'POST') {
      const { action, email, role, userId } = req.body;

      // Invite a new user
      if (action === 'invite') {
        if (!email || !role) return res.status(400).json({ error: 'email and role are required' });

        const data = await adminFetch('invite', {
          method: 'POST',
          body: JSON.stringify({
            email,
            data: { role },
            redirectTo: 'https://clinic.phpchi.org/set-password.html'   // stored in raw_user_meta_data; we'll also set app_metadata below
          })
        });

        // Set app_metadata.role on the newly created user
        await adminFetch(`admin/users/${data.id}`, {
          method: 'PUT',
          body: JSON.stringify({ app_metadata: { role } })
        });

        return res.status(200).json({ success: true });
      }

      // Change an existing user's role
      if (action === 'set_role') {
        if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' });

        await adminFetch(`admin/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({ app_metadata: { role } })
        });

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}