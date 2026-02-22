// Netlify Serverless Function — Secure Anthropic API Proxy
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Health check endpoint
  if (event.httpMethod === "GET") {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    const keyPreview = hasKey ? process.env.ANTHROPIC_API_KEY.slice(0, 10) + "..." : "NOT SET";
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ 
        status: "ok", 
        apiKeyConfigured: hasKey,
        keyPreview: keyPreview,
        message: hasKey ? "API key is configured. Ready." : "ERROR: ANTHROPIC_API_KEY not set in Netlify environment variables."
      }),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set. Go to Netlify Site configuration > Environment variables." }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const requestBody = {
      model: body.model || "claude-3-5-haiku-20241022",
      max_tokens: body.max_tokens || 4096,
      system: body.system || "",
      messages: body.messages || [],
    };
    if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
      requestBody.tools = body.tools;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status, headers,
        body: JSON.stringify({ error: data.error?.message || "API failed", type: data.error?.type, details: data }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error: " + err.message }) };
  }
};
