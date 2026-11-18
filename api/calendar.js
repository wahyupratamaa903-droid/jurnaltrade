function cleanEnv(val) {
  return (val || '').replace(/[\r\n\s]+/g, '').trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const pair = (body.pair || 'XAUUSD').trim().toUpperCase();

  const firecrawlKey = cleanEnv(process.env.FIRECRAWL_API_KEY);
  const exaKey = cleanEnv(process.env.EXA_API_KEY);

  let rawSources = [];

  // 1. Firecrawl Search & Scrape Live dari ForexFactory, Myfxbook & Investing.com
  if (firecrawlKey) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firecrawlKey}`
        },
        body: JSON.stringify({
          query: `${pair} economic calendar high impact news sentiment site:forexfactory.com OR site:myfxbook.com OR site:investing.com`,
          limit: 5,
          scrapeOptions: { formats: ['markdown'] }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data.data) ? data.data : [];
        rawSources = items.map(item => ({
          title: item.title || 'Kalender Ekonomi',
          url: item.url,
          content: (item.markdown || item.description || '').replace(/\s+/g, ' ').slice(0, 700),
          engine: 'Firecrawl Live'
        }));
      }
    } catch (_) {}
  }

  // 2. Fallback ke Exa Search jika Firecrawl belum diisi atau kosong
  if (rawSources.length === 0 && exaKey) {
    try {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': exaKey
        },
        body: JSON.stringify({
          query: `${pair} forex factory economic calendar high impact news today myfxbook outlook`,
          numResults: 5,
          includeDomains: ['forexfactory.com', 'myfxbook.com', 'investing.com', 'fxstreet.com'],
          startPublishedDate: twoDaysAgo,
          contents: { text: { maxCharacters: 650 } }
        })
      });

      if (response.ok) {
        const data = await response.json();
        rawSources = (data.results || []).map(r => ({
          title: r.title || 'Kalender Ekonomi',
          url: r.url,
          content: (r.text || '').replace(/\s+/g, ' ').slice(0, 650),
          engine: 'Exa Live'
        }));
      }
    } catch (_) {}
  }

  if (!firecrawlKey && !exaKey) {
    return res.status(503).json({ error: 'FIRECRAWL_API_KEY / EXA_API_KEY belum diatur di Vercel.' });
  }

  return res.status(200).json({ sources: rawSources });
};
