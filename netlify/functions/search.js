// Netlify Serverless Function — Brave Search Proxy
// Searches the web for real estate listings and mortgage rates

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
    return { statusCode: 500, headers, body: JSON.stringify({ error: "BRAVE_API_KEY not set in environment variables." }) };
  }

  try {
    const body = JSON.parse(event.body);
    const query = body.query;
    const count = body.count || 10;

    if (!query) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Query required" }) };
    }

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&result_filter=web`;

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: data.message || "Brave search failed", details: data }) };
    }

    // Extract clean results
    const results = (data.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age || '',
      extra: r.extra_snippets || [],
    }));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        query: query,
        count: results.length,
        results: results,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Search error: " + err.message }) };
  }
};
