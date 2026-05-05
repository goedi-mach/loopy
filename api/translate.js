export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepL API key not configured' });
  }

  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'EN',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'DeepL error', detail: err });
    }

    const data = await response.json();
    const translated = data.translations?.[0]?.text || text;
    return res.status(200).json({ translated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}