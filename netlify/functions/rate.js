// Fetches today's average 30-year fixed mortgage rate
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    // Fetch from Mortgage News Daily (reliable public source)
    const res = await fetch("https://www.mortgagenewsdaily.com/mortgage-rates/30-year-fixed", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RealtyAI/1.0)" }
    });
    const html = await res.text();

    // Parse rate from page - look for the current rate value
    let rate = null;

    // Try multiple patterns
    const patterns = [
      /current\s*(?:30[- ]?year|30yr)[^"]*?(\d\.\d{1,3})%/i,
      /(\d\.\d{1,3})%\s*<\/td>\s*<td[^>]*>\s*30[- ]?(?:Year|Yr)/i,
      /30[- ]?(?:Year|Yr)[^<]*<[^>]*>(\d\.\d{1,3})%/i,
      /"rate"\s*:\s*"?(\d\.\d{1,3})"?/i,
      /avg30fixed[^}]*"rate"\s*:\s*(\d\.\d{1,3})/i,
      /class="[^"]*rate[^"]*"[^>]*>(\d\.\d{1,3})%/i,
      /(\d\.\d{1,2})%/,
    ];

    for (const p of patterns) {
      const m = html.match(p);
      if (m) {
        const val = parseFloat(m[1]);
        if (val >= 4.0 && val <= 12.0) { rate = val; break; }
      }
    }

    // Fallback: try Freddie Mac PMMS
    if (!rate) {
      try {
        const fRes = await fetch("https://www.freddiemac.com/pmms", {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RealtyAI/1.0)" }
        });
        const fHtml = await fRes.text();
        const fMatch = fHtml.match(/(\d\.\d{1,2})%/);
        if (fMatch) {
          const val = parseFloat(fMatch[1]);
          if (val >= 4.0 && val <= 12.0) rate = val;
        }
      } catch {}
    }

    // Fallback: try Bankrate
    if (!rate) {
      try {
        const bRes = await fetch("https://www.bankrate.com/mortgages/mortgage-rates/", {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RealtyAI/1.0)" }
        });
        const bHtml = await bRes.text();
        const bMatch = bHtml.match(/30[- ]?year[^%]*?(\d\.\d{1,2})%/i);
        if (bMatch) {
          const val = parseFloat(bMatch[1]);
          if (val >= 4.0 && val <= 12.0) rate = val;
        }
      } catch {}
    }

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        rate: rate || 6.75,
        estimated: !rate,
        source: rate ? "market data" : "fallback estimate",
        date: today,
        message: rate ? `Today's 30-year fixed rate: ${rate}%` : "Using estimated rate. Live rate unavailable."
      }),
    };
  } catch (err) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ rate: 6.75, estimated: true, source: "fallback", date: new Date().toLocaleDateString('en-US'), message: "Rate fetch error, using estimate." }),
    };
  }
};
