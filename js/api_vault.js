const AI_VAULT_KEY = 'jurnal_ai_vault_v1';

function getAiVault() {
  try {
    const raw = JSON.parse(localStorage.getItem(AI_VAULT_KEY));
    if (raw && typeof raw === 'object') return raw;
  } catch (_) {}
  return { groq: '', cerebras: '', openrouter1: '', openrouter2: '', exa: '', jina: '' };
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
    showToast('Override API Key pribadi disimpan!');
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

  const customCount = Object.values(v).filter(k => k && k.length > 5).length;
  const badge = document.getElementById('vault-status-badge');
  if (badge) {
    badge.textContent = customCount > 0 ? `Server + ${customCount} Custom` : 'Server Aktif (Auto)';
    badge.className = 'text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
  }
}

function hasAnyLlmKey() {
  return true; // Selalu siap pakai via Server Vercel /api/ai
}

function hasAnySearchKey() {
  return true; // Selalu siap pakai via Server Vercel /api/news
}

// Memanggil endpoint backend Vercel /api/ai (atau override lokal jika diisi)
async function callLlmWithFailover(messages, jsonMode = false) {
  const v = getAiVault();

  // Jika user mengisi kunci pribadi di perangkat, prioritaskan dulu
  if (v.groq) {
    try {
      const payload = { model: 'llama-3.3-70b-versatile', messages, temperature: jsonMode ? 0.1 : 0.35 };
      if (jsonMode) payload.response_format = { type: 'json_object' };
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${v.groq}` },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        const d = await r.json();
        const c = d?.choices?.[0]?.message?.content;
        if (c) return { content: c, provider: 'Groq (Custom Lokal)' };
      }
    } catch (_) {}
  }

  // Jalur utama tanpa perlu isi key: Vercel Serverless Proxy (/api/ai)
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, jsonMode })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Server AI Error (${res.status})`);
  }
  return { content: data.content, provider: data.provider || 'Server AI' };
}

// Memanggil endpoint backend Vercel /api/news
async function searchTrustedMarketNews(pairSymbol) {
  const res = await fetch('/api/news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pair: pairSymbol })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Server Berita Error (${res.status})`);
  }
  return Array.isArray(data.articles) ? data.articles : [];
}

window.addEventListener('DOMContentLoaded', populateAiVaultInputs);
