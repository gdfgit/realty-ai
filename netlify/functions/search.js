// Netlify Serverless Function — Brave Search Proxy (Web + Images)
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const apiKey = BRAVE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "BRAVE_API_KEY not set" }) };

  try {
    const body = JSON.parse(event.body);
    const query = body.query;
    const count = Math.min(body.count || 8, 15);
    const wantImages = body.images || false;

    if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: "Query required" }) };

    // Web search
    const webUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&extra_snippets=true&result_filter=web`;
    const webRes = await fetch(webUrl, {
      headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": apiKey },
    });
    const webData = await webRes.json();

    const results = (webData.web?.results || []).map(r => ({
      title: r.title || '', url: r.url || '', description: r.description || '',
      age: r.age || '', extra: r.extra_snippets || [],
    }));

    // Image search (when requested)
    let images = [];
    if (wantImages) {
      try {
        const imgUrl = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=6`;
        const imgRes = await fetch(imgUrl, {
          headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": apiKey },
        });
        const imgData = await imgRes.json();
        images = (imgData.results || []).map(r => ({
          url: r.properties?.url || r.thumbnail?.src || '',
          title: r.title || '',
          source: r.source || '',
        })).filter(img => img.url && img.url.startsWith('http'));
      } catch (e) { /* image search optional */ }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ query, count: results.length, results, images }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Search error: " + err.message }) };
  }
};
