// auth.js — silent token refresh, include on every authenticated page
(function () {
  const SUPABASE_URL      = CONFIG.SUPABASE_URL;
  const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
  const INTERVAL_MS       = 45 * 60 * 1000; // refresh every 45 minutes

  async function refreshToken() {
    const refresh_token = localStorage.getItem('php_refresh_token');
    if (!refresh_token) return;

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body:    JSON.stringify({ refresh_token })
      });
      if (!res.ok) return; // silently fail — handleExpired() will catch it on next API call
      const data = await res.json();
      localStorage.setItem('php_token',         data.access_token);
      localStorage.setItem('php_refresh_token', data.refresh_token);
    } catch (err) {
      console.warn('Token refresh failed:', err);
    }
  }

  // Refresh once shortly after page load, then on interval
  setTimeout(refreshToken, 5000);
  setInterval(refreshToken, INTERVAL_MS);
})();