module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const messages = body.messages;
  const jsonMode = Boolean(body.jsonMode);

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
  }

  // Daftar provider AI otomatis dari Environment Variables Vercel (Failover berurutan)
  const providers = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'Groq (Llama 3.3 70B)',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile'
    });
  }
  if (process.env.CEREBRAS_API_KEY) {
    providers.push({
      name: 'Cerebras (Llama 3.3 70B)',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      key: process.env.CEREBRAS_API_KEY,
      model: 'llama-3.3-70b'
    });
  }
  if (process.env.SAMBANOVA_API_KEY) {
    providers.push({
      name: 'SambaNova (Llama 3.3 70B)',
      url: 'https://api.sambanova.ai/v1/chat/completions',
      key: process.env.SAMBANOVA_API_KEY,
      model: 'Meta-Llama-3.3-70B-Instruct'
    });
  }
  if (process.env.OPENROUTER_KEY_1) {
    providers.push({
      name: 'OpenRouter Utama',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_KEY_1,
      model: 'google/gemini-2.0-flash-001',
      extraHeaders: { 'HTTP-Referer': 'https://jurnaltrade-eta.vercel.app', 'X-Title': 'Jurnal Trading Analytics' }
    });
  }
  if (process.env.OPENROUTER_KEY_2) {
    providers.push({
      name: 'OpenRouter Cadangan',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_KEY_2,
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      extraHeaders: { 'HTTP-Referer': 'https://jurnaltrade-eta.vercel.app', 'X-Title': 'Jurnal Trading Analytics' }
    });
  }
  if (process.env.SILICONFLOW_API_KEY) {
    providers.push({
      name: 'SiliconFlow (Qwen 2.5 72B)',
      url: 'https://api.siliconflow.cn/v1/chat/completions',
      key: process.env.SILICONFLOW_API_KEY,
      model: 'Qwen/Qwen2.5-72B-Instruct'
    });
  }

  if (providers.length === 0) {
    return res.status(503).json({
      error: 'API Key belum diatur di Environment Variables Vercel.'
    });
  }

  let lastError = 'Semua provider AI gagal merespons.';
  for (const p of providers) {
    try {
      const payload = {
        model: p.model,
        messages: messages,
        temperature: jsonMode ? 0.1 : 0.35
      };
      if (jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const response = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${p.key}`,
          ...(p.extraHeaders || {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errTxt = await response.text();
        lastError = `${p.name} (${response.status}): ${errTxt.slice(0, 120)}`;
        continue;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return res.status(200).json({ content, provider: p.name });
      }
    } catch (err) {
      lastError = `${p.name}: ${err.message}`;
    }
  }

  return res.status(502).json({ error: lastError });
};
