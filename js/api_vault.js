const AI_VAULT_KEY = 'jurnal_ai_vault_v1';

const TRUSTED_FINANCE_DOMAINS = [
  'investing.com',
  'forexfactory.com',
  'myfxbook.com',
  'tradingview.com',
  'bloomberg.com',
  'reuters.com',
  'fxstreet.com',
  'dailyfx.com'
];

function getAiVault() {
  try {
    const raw = JSON.parse(localStorage.getItem(AI_VAULT_KEY));
    if (raw && typeof raw === 'object') return raw;
  } catch (_) {}
  return {
    groq: '',
    cerebras: '',
    openrouter1: '',
    openrouter2: '',
    exa: '',
    jina: ''
  };
}

function saveAiVaultFromUI(e) {
  if (e) e.preventDefault();
  const vault = {
    groq: (document.getElementById('vault-groq')?.value || '').trim(),
    cerebras: (document.getElementById('vault-cerebras')?.value || '').trim(),
    openrouter1: (document.getElementById('vault-or1')?.value || '').trim(),
    openrouter2: (document.getElementById('vault-or2')?.value || '').trim(),
    exa: (document.getElementById('vault-exa')?.value || '').trim(),
    jina: (document.getElementById('vault-jina')?.value || '').trim()
  };

  localStorage.setItem(AI_VAULT_KEY, JSON.stringify(vault));
  populateAiVaultInputs();

  if (typeof showToast === 'function') {
    showToast('Brankas API Key berhasil disimpan di perangkat ini!');
  } else {
    alert('API Key berhasil disimpan!');
  }
}

function populateAiVaultInputs() {
  const v = getAiVault();
  const map = {
    'vault-groq': v.groq,
    'vault-cerebras': v.cerebras,
    'vault-or1': v.openrouter1,
    'vault-or2': v.openrouter2,
    'vault-exa': v.exa,
    'vault-jina': v.jina
  };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = map[id] || '';
  });

  const activeCount = Object.values(v).filter(k => k && k.length > 5).length;
  const badge = document.getElementById('vault-status-badge');
  if (badge) {
    badge.textContent = activeCount > 0 ? `${activeCount} API Aktif` : 'Belum Diisi';
    badge.className = activeCount > 0
      ? 'text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
      : 'text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
  }
}

function hasAnyLlmKey() {
  const v = getAiVault();
  return Boolean(v.groq || v.cerebras || v.openrouter1 || v.openrouter2);
}

function hasAnySearchKey() {
  const v = getAiVault();
  return Boolean(v.exa || v.jina);
}

// Panggilan LLM dengan Multi-Provider Failover otomatis
async function callLlmWithFailover(messages, jsonMode = false) {
  const v = getAiVault();
  const providers = [];

  if (v.groq) {
    providers.push({
      name: 'Groq (Llama 3.3 70B)',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: v.groq,
      model: 'llama-3.3-70b-versatile'
    });
  }
  if (v.cerebras) {
    providers.push({
      name: 'Cerebras (Llama 3.3 70B)',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      key: v.cerebras,
      model: 'llama-3.3-70b'
    });
  }
  if (v.openrouter1) {
    providers.push({
      name: 'OpenRouter Utama',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: v.openrouter1,
      model: 'google/gemini-2.0-flash-001',
      extraHeaders: { 'HTTP-Referer': window.location.origin, 'X-Title': 'Jurnal Trading Analytics' }
    });
  }
  if (v.openrouter2) {
    providers.push({
      name: 'OpenRouter Cadangan',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: v.openrouter2,
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      extraHeaders: { 'HTTP-Referer': window.location.origin, 'X-Title': 'Jurnal Trading Analytics' }
    });
  }

  if (providers.length === 0) {
    throw new Error('NO_LLM_KEY');
  }

  let lastError = null;
  for (const p of providers) {
    try {
      const body = {
        model: p.model,
        messages: messages,
        temperature: jsonMode ? 0.1 : 0.35
      };
      if (jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${p.key}`,
          ...(p.extraHeaders || {})
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(`${p.name} (${res.status}): ${errTxt.slice(0, 120)}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return { content, provider: p.name };
      }
    } catch (err) {
      lastError = err;
      console.warn(`Failover dari ${p.name}:`, err.message);
    }
  }

  throw lastError || new Error('Semua provider AI gagal merespons.');
}

function extractDomainName(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch (_) {
    return 'sumber-web';
  }
}

// Pencarian Berita Real-Time dari Situs Finansial Terpercaya (Exa Search -> Jina AI)
async function searchTrustedMarketNews(pairSymbol) {
  const v = getAiVault();
  const cleanPair = (pairSymbol || 'XAUUSD').trim().toUpperCase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Prioritas Utama: Exa Search API dengan filter domain terpercaya
  if (v.exa) {
    try {
      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': v.exa
        },
        body: JSON.stringify({
          query: `${cleanPair} latest market news analysis forecast forex gold`,
          numResults: 6,
          includeDomains: TRUSTED_FINANCE_DOMAINS,
          startPublishedDate: sevenDaysAgo,
          contents: {
            text: { maxCharacters: 750 }
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const items = (data.results || []).map(r => ({
          title: r.title || `Berita ${cleanPair}`,
          url: r.url,
          domain: extractDomainName(r.url),
          publishedDate: r.publishedDate ? r.publishedDate.slice(0, 10) : 'Terbaru',
          snippet: (r.text || '').replace(/\s+/g, ' ').trim().slice(0, 450),
          engine: 'Exa Search'
        }));
        if (items.length > 0) return items;
      }
    } catch (err) {
      console.warn('Exa Search gagal, beralih ke Jina AI:', err.message);
    }
  }

  // 2. Cadangan: Jina AI Search (s.jina.ai)
  if (v.jina) {
    try {
      const q = encodeURIComponent(`${cleanPair} market news analysis`);
      const res = await fetch(`https://s.jina.ai/${q}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${v.jina}`,
          'X-Site': TRUSTED_FINANCE_DOMAINS.join(',')
        }
      });

      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data.data) ? data.data : [];
        const items = rawList.slice(0, 6).map(r => ({
          title: r.title || `Berita ${cleanPair}`,
          url: r.url,
          domain: extractDomainName(r.url),
          publishedDate: 'Terbaru',
          snippet: (r.description || r.content || '').replace(/\s+/g, ' ').trim().slice(0, 450),
          engine: 'Jina AI'
        }));
        if (items.length > 0) return items;
      }
    } catch (err) {
      console.warn('Jina AI gagal:', err.message);
    }
  }

  if (!v.exa && !v.jina) {
    throw new Error('NO_SEARCH_KEY');
  }
  return [];
}

window.addEventListener('DOMContentLoaded', populateAiVaultInputs);
