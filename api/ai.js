function cleanEnv(val) {
  return (val || '').replace(/[\r\n\s]+/g, '').trim();
}

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

  const groqKey = cleanEnv(process.env.GROQ_API_KEY);
  const cerebrasKey = cleanEnv(process.env.CEREBRAS_API_KEY);
  const orKey1 = cleanEnv(process.env.OPENROUTER_KEY_1);
  const orKey2 = cleanEnv(process.env.OPENROUTER_KEY_2);
  const sambaKey = cleanEnv(process.env.SAMBANOVA_API_KEY);
  const nvidiaKey = cleanEnv(process.env.NVIDIA_API_KEY);
  const deepinfraKey = cleanEnv(process.env.DEEPINFRA_API_KEY);

  const providers = [];

  if (groqKey) {
    providers.push({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqKey,
      model: 'llama-3.3-70b-versatile',
      supportsJsonFormat: true
    });
  }
  if (cerebrasKey) {
    providers.push({
      name: 'Cerebras',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      key: cerebrasKey,
      model: 'llama3.3-70b',
      supportsJsonFormat: true
    });
  }
  if (orKey1) {
    providers.push({
      name: 'OpenRouter-1',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: orKey1,
      model: 'openrouter/free',
      supportsJsonFormat: false,
      extraHeaders: {
        'HTTP-Referer': 'https://jurnaltrade-eta.vercel.app',
        'X-Title': 'Jurnal Trading Analytics'
      }
    });
  }
  if (orKey2) {
    providers.push({
      name: 'OpenRouter-2',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: orKey2,
      model: 'openrouter/free',
      supportsJsonFormat: false,
      extraHeaders: {
        'HTTP-Referer': 'https://jurnaltrade-eta.vercel.app',
        'X-Title': 'Jurnal Trading Analytics'
      }
    });
  }
  if (sambaKey) {
    providers.push({
      name: 'SambaNova',
      url: 'https://api.sambanova.ai/v1/chat/completions',
      key: sambaKey,
      model: 'Meta-Llama-3.3-70B-Instruct',
      supportsJsonFormat: false
    });
  }
  if (nvidiaKey) {
    providers.push({
      name: 'NVIDIA',
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      key: nvidiaKey,
      model: 'meta/llama-3.3-70b-instruct',
      supportsJsonFormat: false
    });
  }
  if (deepinfraKey) {
    providers.push({
      name: 'DeepInfra',
      url: 'https://api.deepinfra.com/v1/openai/chat/completions',
      key: deepinfraKey,
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      supportsJsonFormat: false
    });
  }

  if (providers.length === 0) {
    return res.status(503).json({
      error: 'Belum ada API Key AI yang terdeteksi di Environment Variables Vercel.'
    });
  }

  const errorLogs = [];

  for (const p of providers) {
    try {
      const payload = {
        model: p.model,
        messages: messages,
        temperature: jsonMode ? 0.1 : 0.35
      };
      if (jsonMode && p.supportsJsonFormat) {
        payload.response_format = { type: 'json_object' };
      }

      const response = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${p.key}`,
          'User-Agent': 'JurnalTrade-Server/1.0',
          ...(p.extraHeaders || {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errTxt = await response.text();
        errorLogs.push(`${p.name} (${response.status}): ${errTxt.slice(0, 90)}`);
        continue;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return res.status(200).json({ content, provider: p.name });
      }
    } catch (err) {
      errorLogs.push(`${p.name}: ${err.message}`);
    }
  }

  return res.status(502).json({
    error: errorLogs.join(' | ')
  });
};
