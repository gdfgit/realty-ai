const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };
  if (!TAVILY_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "TAVILY_API_KEY not set" }) };

  try {
    const body = JSON.parse(event.body);
    const query = body.query;
    if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: "Query required" }) };

    const tavilyBody = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "basic",
      include_answer: true,
      include_images: body.images || false,
      include_raw_content: false,
      max_results: Math.min(body.count || 5, 8),
    };

    console.log("[TAVILY] Searching:", query);
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tavilyBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[TAVILY] Error:", res.status, errText);
      return { statusCode: res.status, headers, body: JSON.stringify({ error: "Tavily error: " + res.status }) };
    }

    const data = await res.json();
    console.log("[TAVILY] Got", (data.results || []).length, "results");

    const results = (data.results || []).map(r => ({
      title: r.title || "",
      url: r.url || "",
      description: r.content || "",
    }));

    // Handle both old and new Tavily image formats
    let images = [];
    if (data.images) {
      images = data.images.map(img => {
        if (typeof img === "string") return { url: img };
        if (img && img.url) return { url: img.url };
        return null;
      }).filter(x => x && x.url);
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        query, count: results.length, results, images,
        answer: data.answer || "",
      }),
    };
  } catch (err) {
    console.error("[TAVILY] Exception:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
