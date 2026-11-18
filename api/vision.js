function cleanEnv(val) {
  return (val || '').replace(/[\r\n\s]+/g, '').trim();
}

async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getFastFreeVisionModels() {
  try {
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {}, 4000);
    if (res.ok) {
      const json = await res.json();
      const models = Array.isArray(json.data) ? json.data : [];
      const freeVision = models
        .filter(m => {
          const id = String(m.id || '');
          const modal = m.architecture?.input_modalities || [];
          return id.endsWith(':free') && modal.includes('image');
        })
        .map(m => m.id);
      if (freeVision.length > 0) {
        return freeVision.slice(0, 2);
      }
    }
  } catch (_) {}
  return [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const imageBase64 = body.imageBase64;
  const todayFormatted = body.today || '';
  const defaultSess = body.defaultSession || 'Asia';

  if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
    return res.status(400).json({ error: 'File gambar tidak valid.' });
  }

  const promptText = `Analisa screenshot aplikasi trading MT4/MT5/Broker atau chart TradingView ini.
Jika di gambar terdapat BANYAK baris transaksi/posisi (misalnya 2 sampai 20 baris posisi), ekstrak SEMUA baris transaksi tersebut!
Perhatikan mata uang akun di bagian atas (misal IDR atau USD). Jika sudah IDR, gunakan angkanya langsung (bulatkan ke integer). Jika USD, kalikan 16000 untuk konversi ke Rupiah.

Kembalikan HANYA objek JSON valid dengan format persis seperti ini:
{
  "currency": "IDR atau USD",
  "trades": [
    {
      "date": "DD/MM/YYYY (gunakan ${todayFormatted} jika tidak tertulis di baris)",
      "session": "${defaultSess}",
      "pair": "SYMBOL HURUF KAPITAL (contoh: BTCUSD, XAUUSD, EURUSD)",
      "side": "BUY atau SELL",
      "lot": "0.01",
      "rr": "1 : 2 atau kosongkan",
      "risk": 0,
      "status": "TP jika profit > 0, SL jika rugi < 0, BE jika 0.00",
      "nominal": 1600,
      "pips": "selisih harga/pips jika bisa dihitung, atau kosong",
      "reason": "Entry -> Exit (contoh: 64168.50 -> 64178.21) hasil scan MT5",
      "info": "Auto-import Screenshot MT5"
    }
  ]
}
Keluarkan HANYA JSON murni tanpa markdown atau penjelasan tambahan.`;

  const orKey1 = cleanEnv(process.env.OPENROUTER_KEY_1);
  const orKey2 = cleanEnv(process.env.OPENROUTER_KEY_2);

  if (!orKey1 && !orKey2) {
    return res.status(503).json({ error: 'OPENROUTER_KEY belum diatur di Vercel.' });
  }

  const detected = await getFastFreeVisionModels();
  const candidates = [...new Set([...detected, 'openrouter/free'])].slice(0, 3);
  const keys = [orKey1, orKey2].filter(Boolean);
  const errors = [];

  for (let i = 0; i < candidates.length; i++) {
    const modelId = candidates[i];
    const key = keys[i % keys.length];
    try {
      const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'https://jurnaltrade-eta.vercel.app',
          'X-Title': 'Jurnal Trading Analytics'
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0.1,
          max_tokens: 1800,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                { type: 'image_url', image_url: { url: imageBase64 } }
              ]
            }
          ]
        })
      }, 9500);

      if (!response.ok) {
        const errTxt = await response.text();
        errors.push(`${modelId} (${response.status}): ${errTxt.slice(0, 60)}`);
        continue;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return res.status(200).json({ content, provider: `OpenRouter (${modelId})` });
      }
    } catch (err) {
      errors.push(`${modelId}: ${err.name === 'AbortError' ? 'Timeout' : err.message}`);
    }
  }

  return res.status(502).json({ error: errors.join(' | ') });
};
