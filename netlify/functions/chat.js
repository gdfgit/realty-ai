// Anthropic API Proxy — Claude Opus 4.6
exports.handler = async (event) => {
  const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: H, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: H, body: JSON.stringify({ error: "POST only" }) };

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, headers: H, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }) };

  try {
    const body = JSON.parse(event.body);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: body.model || "claude-opus-4-6",
        max_tokens: body.max_tokens || 4096,
        system: body.system || "",
        messages: body.messages || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) return { statusCode: res.status, headers: H, body: JSON.stringify({ error: data.error?.message || "API error", details: data }) };
    return { statusCode: 200, headers: H, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
  }
};
