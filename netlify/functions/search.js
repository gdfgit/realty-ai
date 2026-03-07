// Tavily Search Proxy
exports.handler = async (event) => {
  const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: H, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: H, body: JSON.stringify({ error: "POST only" }) };

  const KEY = process.env.TAVILY_API_KEY;
  if (!KEY) return { statusCode: 500, headers: H, body: JSON.stringify({ error: "TAVILY_API_KEY not set" }) };

  try {
    const body = JSON.parse(event.body);
    if (!body.query) return { statusCode: 400, headers: H, body: JSON.stringify({ error: "query required" }) };

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: KEY,
        query: body.query,
        search_depth: "basic",
        include_answer: true,
        include_images: body.images || false,
        include_raw_content: false,
        max_results: Math.min(body.count || 5, 8),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[TAVILY]", res.status, err);
      return { statusCode: res.status, headers: H, body: JSON.stringify({ error: "Tavily " + res.status }) };
    }

    const data = await res.json();
    const results = (data.results || []).map(r => ({ title: r.title || "", url: r.url || "", content: r.content || "" }));
    const images = (data.images || []).map(img => typeof img === "string" ? img : (img && img.url ? img.url : "")).filter(Boolean);

    return { statusCode: 200, headers: H, body: JSON.stringify({ results, images, answer: data.answer || "" }) };
  } catch (err) {
    console.error("[TAVILY]", err.message);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
  }
};
