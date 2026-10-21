import { requireRole } from './_auth.js';

const MAX_CHARS = 5000; // DeepL free allows ~500,000 characters a month; keep single requests small.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Any signed-in user (volunteer, staff or admin) may translate.
  const caller = await requireRole(req, res, 'any');
  if (!caller) return;

  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }
  if (text.length > MAX_CHARS) {
    return res.status(413).json({ error: `Text is too long (limit ${MAX_CHARS} characters)` });
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepL API key not configured' });
  }

  // Free keys end in ":fx" and use a different host from paid keys.
  const host = apiKey.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://${host}/v2/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'EN',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`DeepL error ${response.status}: ${detail}`);
      if (response.status === 456) {
        return res.status(502).json({ error: 'The monthly translation limit has been reached.' });
      }
      return res.status(502).json({ error: 'The translation service returned an error.' });
    }

    const data = await response.json();
    const translated = data.translations?.[0]?.text || text;
    return res.status(200).json({ translated });
  } catch (err) {
    console.error(err);
    const msg = err.name === 'AbortError' ? 'The translation service took too long.' : 'Translation failed.';
    return res.status(500).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
}