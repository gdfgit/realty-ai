// Netlify Serverless Function — Tavily Search Proxy (Real Estate Focused)
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  if (!TAVILY_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "TAVILY_API_KEY not set" }) };

  try {
    const body = JSON.parse(event.body);
    const query = body.query;
    const maxResults = Math.min(body.count || 8, 10);
    const wantImages = body.images || false;

    if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: "Query required" }) };

    // Use advanced search for better property data extraction
    const tavilyBody = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      include_answer: true,
      include_images: wantImages,
      include_raw_content: false,
      max_results: maxResults,
    };

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tavilyBody),
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: data.detail || data.message || "Search failed" }) };
    }

    const results = (data.results || []).map(r => ({
      title: r.title || "",
      url: r.url || "",
      description: r.content || "",
      score: r.score || 0,
      extra: [],
    }));

    const images = (data.images || []).map(url => ({
      url: typeof url === "string" ? url : (url.url || ""),
      title: "",
      source: "",
    })).filter(img => img.url && img.url.startsWith("http"));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        query,
        count: results.length,
        results,
        images,
        answer: data.answer || "",
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Search error: " + err.message }) };
  }
};
