function cleanEnv(val) {
  return (val || '').replace(/[\r\n\s]+/g, '').trim();
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

  const promptText = `Analisa screenshot riwayat transaksi trading MT4/MT5/Broker atau chart TradingView ini.
Ekstrak SEMUA baris posisi/transaksi yang terlihat di gambar!
Perhatikan mata uang akun (misal IDR atau USD). Jika sudah IDR, tulis angkanya langsung (bulatkan ke integer). Jika USD, kalikan 16000 untuk konversi ke Rupiah.

Kembalikan HANYA JSON valid dengan format:
{
  "currency": "IDR atau USD",
  "trades": [
    {
      "date": "${todayFormatted}",
      "session": "${defaultSess}",
      "pair": "BTCUSD",
      "side": "BUY atau SELL",
      "lot": "0.01",
      "rr": "",
      "risk": 0,
      "status": "TP jika profit > 0, SL jika rugi < 0, BE jika 0.00",
      "nominal": 1600,
      "pips": "",
      "reason": "64168.50 -> 64178.21 (Scan MT5)",
      "info": "Auto-import Screenshot"
    }
  ]
}
Keluarkan HANYA JSON murni tanpa teks lain.`;

  const orKey1 = cleanEnv(process.env.OPENROUTER_KEY_1);
  const orKey2 = cleanEnv(process.env.OPENROUTER_KEY_2);

  if (!orKey1 && !orKey2) {
    return res.status(503).json({ error: 'OPENROUTER_KEY belum diatur di Vercel.' });
  }

  // Ambil daftar model vision gratis aktif dari OpenRouter
  let visionModels = ['openrouter/free'];
  try {
    const mRes = await fetch('https://openrouter.ai/api/v1/models');
    if (mRes.ok) {
      const mJson = await mRes.json();
      const found = (mJson.data || [])
        .filter(m => String(m.id || '').endsWith(':free') && (m.architecture?.input_modalities || []).includes('image'))
        .map(m => m.id)
        .slice(0, 4);
      if (found.length > 0) {
        visionModels = [...new Set([...found, 'openrouter/free'])];
      }
    }
  } catch (_) {}

  const keys = [orKey1, orKey2].filter(Boolean);

  // Jalankan semua kandidat secara PARALEL (Promise.any) -> siapa paling cepat membalas JSON valid, dia yang dipakai!
  const tasks = visionModels.map((modelId, idx) => (async () => {
    const key = keys[idx % keys.length];
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
    });

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`${modelId} (${response.status}): ${errTxt.slice(0, 60)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || !content.includes('{')) {
      throw new Error(`${modelId}: Respon kosong`);
    }

    return { content, provider: `OpenRouter (${modelId})` };
  })());

  try {
    const fastest = await Promise.any(tasks);
    return res.status(200).json(fastest);
  } catch (aggErr) {
    const reasons = (aggErr.errors || []).map(e => e.message).join(' | ');
    return res.status(502).json({ error: reasons || 'Semua model Vision sedang antre penuh.' });
  }
};
