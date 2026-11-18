function cleanEnv(val) {
  return (val || '').replace(/[\r\n\s]+/g, '').trim();
}

async function getLiveFreeVisionModels() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
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
        return freeVision.slice(0, 4);
      }
    }
  } catch (_) {}
  return ['openrouter/free'];
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

  const promptText = `Analisa gambar screenshot transaksi trading (MT4/MT5/Broker) atau chart TradingView ini.
Ekstrak informasi trading dan kembalikan HANYA objek JSON murni tanpa teks lain:
- "date": format "DD/MM/YYYY" (ambil dari tanggal di gambar jika terlihat, jika tidak gunakan "${todayFormatted}").
- "session": pilih persis salah satu dari ["Asia", "London", "New York"] (gunakan "${defaultSess}" jika tidak terlihat).
- "pair": simbol instrumen huruf kapital (contoh: "XAUUSD", "EURUSD", "BTCUSD", "US30").
- "side": pilih persis "BUY" atau "SELL".
- "lot": string 2 desimal (contoh: "0.01", "0.05", "0.10"). Default "0.01" jika tidak terlihat.
- "rr": format rasio seperti "1 : 2" jika terlihat atau bisa dihitung dari SL/TP, jika tidak "".
- "risk": angka integer Rupiah (0 jika tidak terlihat).
- "status": pilih persis salah satu dari ["TP", "SL", "SL+", "BE"] berdasarkan hasil profit/loss di gambar.
- "nominal": angka integer absolut Rupiah (jika angka di gambar memakai USD seperti $25.50, kalikan 16000 menjadi 408000; jika sudah Rupiah tulis langsung).
- "pips": angka selisih pips jika terlihat, atau "".
- "reason": rangkuman teknikal / harga entry-exit / pola struktur chart yang terlihat pada gambar dalam bahasa Indonesia.
- "info": catatan kondisi eksekusi atau "-" jika tidak ada.`;

  const orKey1 = cleanEnv(process.env.OPENROUTER_KEY_1);
  const orKey2 = cleanEnv(process.env.OPENROUTER_KEY_2);

  if (!orKey1 && !orKey2) {
    return res.status(503).json({ error: 'OPENROUTER_KEY belum diatur di Vercel.' });
  }

  const liveModels = await getLiveFreeVisionModels();
  if (!liveModels.includes('openrouter/free')) {
    liveModels.push('openrouter/free');
  }

  const keys = [orKey1, orKey2].filter(Boolean);
  const errors = [];

  for (const modelId of liveModels) {
    for (let i = 0; i < keys.length; i++) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keys[i]}`,
            'HTTP-Referer': 'https://jurnaltrade-eta.vercel.app',
            'X-Title': 'Jurnal Trading Analytics'
          },
          body: JSON.stringify({
            model: modelId,
            temperature: 0.1,
            max_tokens: 900,
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
          errors.push(`${modelId} (${response.status}): ${errTxt.slice(0, 70)}`);
          continue;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          return res.status(200).json({ content, provider: `OpenRouter (${modelId})` });
        }
      } catch (err) {
        errors.push(`${modelId}: ${err.message}`);
      }
    }
  }

  return res.status(502).json({ error: errors.join(' | ') });
};
