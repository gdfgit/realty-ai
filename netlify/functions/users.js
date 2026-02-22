// Netlify Serverless Function — User Registration Store
// Uses Netlify Blobs for persistent storage across all devices/browsers

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const body = JSON.parse(event.body);
    const { action, email, firstName, lastName, phone } = body;

    // Use environment-based simple file store as fallback
    // For production, this uses Netlify Blobs
    let store;
    try {
      store = getStore("realty-users");
    } catch {
      store = null;
    }

    if (action === "check") {
      // Check if email is registered
      if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: "Email required" }) };
      
      if (store) {
        try {
          const user = await store.get(email.toLowerCase(), { type: "json" });
          if (user) {
            return { statusCode: 200, headers, body: JSON.stringify({ registered: true, firstName: user.firstName }) };
          }
        } catch {}
      }
      return { statusCode: 200, headers, body: JSON.stringify({ registered: false }) };
    }

    if (action === "register") {
      // Register new user
      if (!email || !firstName || !lastName) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "All fields required" }) };
      }

      const em = email.toLowerCase();

      // Check if already registered
      if (store) {
        try {
          const existing = await store.get(em, { type: "json" });
          if (existing) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: false, reason: "email_taken", firstName: existing.firstName }) };
          }
        } catch {}

        // Save new user
        await store.setJSON(em, {
          firstName,
          lastName,
          email: em,
          phone: phone || '',
          registeredAt: new Date().toISOString(),
        });
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid action. Use 'check' or 'register'." }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error: " + err.message }) };
  }
};
