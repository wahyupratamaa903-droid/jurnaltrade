function hasAnyLlmKey() {
  return true;
}

function hasAnySearchKey() {
  return true;
}

async function callLlmWithFailover(messages, jsonMode = false) {
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
