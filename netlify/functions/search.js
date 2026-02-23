// Netlify Serverless Function — Brave Search Proxy
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
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "BRAVE_API_KEY not set" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const query = body.query;
    const count = Math.min(body.count || 8, 15);

    if (!query) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Query required" }) };
    }

    // Search with extra snippets enabled for more property detail
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&extra_snippets=true&result_filter=web`;

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: data.message || "Search failed" }) };
    }

    const results = (data.web?.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      description: r.description || '',
      age: r.age || '',
      extra: r.extra_snippets || [],
    }));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ query, count: results.length, results }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Search error: " + err.message }) };
  }
};
