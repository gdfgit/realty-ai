// Netlify Function — Search nationrealtor.axenrealty.com via Tavily
// Uses include_domains to restrict results to the Nation Realtor site
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
  if (!TAVILY_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "No API key" }) };

  try {
    const body = JSON.parse(event.body);
    const query = body.query || '';
    if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: "Query required" }) };

    // Search ONLY nationrealtor.axenrealty.com using Tavily
    const tavilyBody = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      include_answer: true,
      include_images: true,
      include_raw_content: false,
      max_results: 5,
      include_domains: ["nationrealtor.axenrealty.com"],
    };

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tavilyBody),
    });
    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: data.detail || "Search failed" }) };
    }

    // Extract listings from Tavily results
    const listings = (data.results || []).map(r => {
      // Parse address, price, beds, baths, sqft from the content
      const content = r.content || '';
      const title = r.title || '';
      const url = r.url || '';

      // Extract price
      const priceMatch = content.match(/\$[\d,]+/) || title.match(/\$[\d,]+/);
      const price = priceMatch ? priceMatch[0] : '';

      // Extract beds
      const bedsMatch = content.match(/(\d+)\s*(?:bed|br|Bed)/i);
      const beds = bedsMatch ? bedsMatch[1] : '';

      // Extract baths
      const bathsMatch = content.match(/(\d+(?:\.\d)?)\s*(?:bath|ba|Bath)/i);
      const baths = bathsMatch ? bathsMatch[1] : '';

      // Extract sqft
      const sqftMatch = content.match(/([\d,]+)\s*(?:sq\s*ft|sqft|SqFt|Sq\.\s*Ft)/i);
      const sqft = sqftMatch ? sqftMatch[1].replace(/,/g, '') : '';

      // Extract address from title or content
      const addrMatch = content.match(/\d+\s+[\w\s]+(?:ST|AVE|BLVD|RD|DR|LN|CT|WAY|PL|CIR|TER|PKWY|St|Ave|Blvd|Rd|Dr|Ln|Ct|Way|Pl)[,.\s]+[\w\s]+,\s*[A-Z]{2}\s+\d{5}/i)
        || title.match(/\d+\s+[\w\s]+(?:ST|AVE|BLVD|RD|DR|LN|CT|WAY|PL|CIR|TER|PKWY|St|Ave|Blvd|Rd|Dr|Ln|Ct|Way|Pl)[,.\s]+[\w\s]+,\s*[A-Z]{2}\s+\d{5}/i);
      const address = addrMatch ? addrMatch[0].trim() : '';

      return {
        title: title,
        url: url,
        address: address,
        price: price,
        beds: beds,
        baths: baths,
        sqft: sqft,
        description: content.substring(0, 300),
        raw: content,
      };
    });

    // Images from nationrealtor
    const images = (data.images || []).map(u => typeof u === 'string' ? u : (u.url || '')).filter(u => u.startsWith('http'));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        query,
        answer: data.answer || '',
        listings,
        images,
        count: listings.length,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
