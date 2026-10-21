import { authHeaders } from './lib/api';

// POST to our own /api routes, always with the signed-in user's token.
export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const h: any = await authHeaders();
  const auth: string = h?.Authorization || h?.authorization || '';
  if (!auth) throw new Error('You are not signed in. Please sign in again.');

  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('API route not found. /api routes only work on a deployed Vercel preview, not on npm run dev.');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(data?.error || 'Not authorized. Try signing out and back in.');
    }
    throw new Error(data?.error || res.statusText || 'Request failed');
  }
  return data as T;
}