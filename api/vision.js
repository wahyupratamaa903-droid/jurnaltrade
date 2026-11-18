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

  const groqKey = cleanEnv(process.env.GROQ_API_KEY);
  const nvidiaKey = cleanEnv(process.env.NVIDIA_API_KEY);
  const orKey1 = cleanEnv(process.env.OPENROUTER_KEY_1);
  const orKey2 = cleanEnv(process.env.OPENROUTER_KEY_2);

  const visionProviders = [];

  if (groqKey) {
    visionProviders.push({
      name: 'Groq Vision (Llama 4 Scout)',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqKey,
      model: 'meta-llama/llama-4-scout-17b-16e-instruct'
    });
  }
  if (nvidiaKey) {
    visionProviders.push({
      name: 'NVIDIA NIM Vision',
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      key: nvidiaKey,
      model: 'meta/llama-3.2-90b-vision-instruct'
    });
  }
  if (orKey1) {
    visionProviders.push({
      name: 'OpenRouter Vision-1',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: orKey1,
      model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
      extraHeaders: { 'HTTP-Referer': 'https://jurnaltrade-eta.vercel.app', 'X-Title': 'Jurnal Trading Analytics' }
    });
  }
  if (orKey2) {
    visionProviders.push({
      name: 'OpenRouter Vision-2',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: orKey2,
      model: 'qwen/qwen2.5-vl-72b-instruct:free',
      extraHeaders: { 'HTTP-Referer': 'https://jurnaltrade-eta.vercel.app', 'X-Title': 'Jurnal Trading Analytics' }
    });
  }

  if (visionProviders.length === 0) {
    return res.status(503).json({ error: 'API Key Vision (GROQ_API_KEY / NVIDIA_API_KEY) belum diatur di Vercel.' });
  }

  const errors = [];
  for (const p of visionProviders) {
    try {
      const response = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${p.key}`,
          ...(p.extraHeaders || {})
        },
        body: JSON.stringify({
          model: p.model,
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
        errors.push(`${p.name} (${response.status}): ${errTxt.slice(0, 80)}`);
        continue;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return res.status(200).json({ content, provider: p.name });
      }
    } catch (err) {
      errors.push(`${p.name}: ${err.message}`);
    }
  }

  return res.status(502).json({ error: errors.join(' | ') });
};
