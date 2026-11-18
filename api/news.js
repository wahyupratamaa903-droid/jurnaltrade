const TRUSTED_DOMAINS = [
  'investing.com',
  'forexfactory.com',
  'myfxbook.com',
  'tradingview.com',
  'bloomberg.com',
  'reuters.com',
  'fxstreet.com',
  'dailyfx.com'
];

function extractDomain(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch (_) {
    return 'sumber-web';
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const cleanPair = (body.pair || 'XAUUSD').trim().toUpperCase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Prioritas Utama: Exa Search API
  if (process.env.EXA_API_KEY) {
    try {
      const response = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXA_API_KEY
        },
        body: JSON.stringify({
          query: `${cleanPair} latest market news analysis forecast forex gold`,
          numResults: 6,
          includeDomains: TRUSTED_DOMAINS,
          startPublishedDate: sevenDaysAgo,
          contents: { text: { maxCharacters: 750 } }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const articles = (data.results || []).map(r => ({
          title: r.title || `Berita ${cleanPair}`,
          url: r.url,
          domain: extractDomain(r.url),
          publishedDate: r.publishedDate ? r.publishedDate.slice(0, 10) : 'Terbaru',
          snippet: (r.text || '').replace(/\s+/g, ' ').trim().slice(0, 450),
          engine: 'Exa Search'
        }));
        if (articles.length > 0) {
          return res.status(200).json({ articles });
        }
      }
    } catch (_) {}
  }

  // 2. Cadangan: Jina AI Search
  if (process.env.JINA_API_KEY) {
    try {
      const q = encodeURIComponent(`${cleanPair} market news analysis`);
      const response = await fetch(`https://s.jina.ai/${q}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
          'X-Site': TRUSTED_DOMAINS.join(',')
        }
      });

      if (response.ok) {
        const data = await response.json();
        const rawList = Array.isArray(data.data) ? data.data : [];
        const articles = rawList.slice(0, 6).map(r => ({
          title: r.title || `Berita ${cleanPair}`,
          url: r.url,
          domain: extractDomain(r.url),
          publishedDate: 'Terbaru',
          snippet: (r.description || r.content || '').replace(/\s+/g, ' ').trim().slice(0, 450),
          engine: 'Jina AI'
        }));
        if (articles.length > 0) {
          return res.status(200).json({ articles });
        }
      }
    } catch (_) {}
  }

  if (!process.env.EXA_API_KEY && !process.env.JINA_API_KEY) {
    return res.status(503).json({ error: 'EXA_API_KEY / JINA_API_KEY belum diatur di Vercel.' });
  }

  return res.status(200).json({ articles: [] });
};
