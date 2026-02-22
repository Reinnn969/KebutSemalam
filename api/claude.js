/* ============================================================
   KEBUTSEMALAM — api/claude.js
   Vercel Serverless Function
   ============================================================ */

// ===== GANTI KEY DI SINI =====
const API_KEY = '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;
// ==============================

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: { message: 'Method not allowed.' } });

  const { messages, system, model, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Messages kosong.' } });
  }

  const payload = {
    model:      model || 'claude-sonnet-4-20250514',
    max_tokens: Math.min(Math.max(parseInt(max_tokens) || 2000, 100), 8000),
    messages,
  };
  if (system) payload.system = system;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.error) return res.status(response.status).json({ error: data.error });
    return res.status(200).json(data);

  } catch (err) {
    return res.status(502).json({ error: { message: 'Gagal konek: ' + err.message } });
  }
};
