const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verifies the caller's Supabase login token and checks their role.
// Returns { user, role } on success. On failure it has already sent the
// 401/403/500 response and returns null, so the caller should just `return`.
export async function requireRole(req, res, roles = ['staff', 'admin']) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Sign in required.' });
    return null;
  }

  let user;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      res.status(401).json({ error: 'Your session is not valid. Please sign in again.' });
      return null;
    }
    user = await r.json();
  } catch (e) {
    res.status(500).json({ error: 'Could not verify your sign-in.' });
    return null;
  }

  const role = user?.app_metadata?.role;
  if (!roles.includes(role)) {
    res.status(403).json({ error: 'You do not have permission to do this.' });
    return null;
  }
  return { user, role };
}