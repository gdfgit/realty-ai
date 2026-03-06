// Netlify Serverless Function — Nation Realtor Search URL Builder + Page Scraper

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
    const baseUrl = 'https://nationrealtor.axenrealty.com';

    // Build the best search URL for this query
    let searchUrl = '';

    if (body.address) {
      // Specific address — use search query parameter
      searchUrl = `${baseUrl}/search?q=${encodeURIComponent(body.address)}`;
    } else if (body.location) {
      // Area search with filters
      const params = new URLSearchParams();
      params.set('location', body.location);
      if (body.minPrice) params.set('minPrice', body.minPrice);
      if (body.maxPrice) params.set('maxPrice', body.maxPrice);
      if (body.beds) params.set('beds', body.beds);
      if (body.baths) params.set('baths', body.baths);
      searchUrl = `${baseUrl}/search?${params.toString()}`;
    } else {
      searchUrl = `${baseUrl}/search`;
    }

    // Try to fetch the page
    let html = '';
    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      if (res.ok) html = await res.text();
    } catch (e) { /* fetch optional */ }

    // Extract listing data from HTML
    const listings = [];

    // JSON-LD structured data
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
    for (const match of jsonLdMatches) {
      try {
        const jsonStr = match.replace(/<\/?script[^>]*>/gi, '');
        const data = JSON.parse(jsonStr);
        if (data['@type'] === 'RealEstateListing' || data['@type'] === 'Product' || data['@type'] === 'SingleFamilyResidence') {
          listings.push({
            title: data.name || '',
            price: data.offers?.price || data.price || '',
            address: data.address ? `${data.address.streetAddress || ''}, ${data.address.addressLocality || ''}, ${data.address.addressRegion || ''} ${data.address.postalCode || ''}` : '',
            url: data.url || searchUrl,
            image: data.image || '',
            beds: data.numberOfBedrooms || data.numberOfRooms || '',
            baths: data.numberOfBathroomsTotal || '',
            sqft: data.floorSize?.value || '',
            description: data.description || '',
          });
        }
      } catch (e) { /* skip */ }
    }

    // Extract data from HTML patterns
    const extracted = {
      addresses: [],
      prices: [],
      listingUrls: [],
      images: [],
      pageTitle: (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '',
    };

    // Address patterns
    const addrPattern = /\d+\s+[\w\s]+(?:ST|AVE|BLVD|RD|DR|LN|CT|WAY|PL|CIR|TER|PKWY)[,.\s]+(?:[\w\s]+),\s*(?:NV|CA|AZ|FL|TX|NY|CO|WA|OR|UT|ID|MT|NM)\s+\d{5}/gi;
    extracted.addresses = [...new Set((html.match(addrPattern) || []))].slice(0, 10);

    // Prices
    const pricePattern = /\$[\d,]+/g;
    extracted.prices = [...new Set((html.match(pricePattern) || []))].filter(p => {
      const num = parseInt(p.replace(/[$,]/g, ''));
      return num > 50000 && num < 50000000;
    }).slice(0, 10);

    // Listing URLs
    const urlPattern = /href="([^"]*(?:listing|property|detail|homedetails)[^"]*)"/gi;
    let urlMatch;
    while ((urlMatch = urlPattern.exec(html)) !== null) {
      let u = urlMatch[1];
      if (u.startsWith('/')) u = baseUrl + u;
      extracted.listingUrls.push(u);
    }
    extracted.listingUrls = [...new Set(extracted.listingUrls)].slice(0, 10);

    // Images
    const imgPattern = /(?:src|data-src)="(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    let imgMatch;
    while ((imgMatch = imgPattern.exec(html)) !== null) {
      if (!imgMatch[1].includes('logo') && !imgMatch[1].includes('icon') && !imgMatch[1].includes('avatar')) {
        extracted.images.push(imgMatch[1]);
      }
    }
    extracted.images = [...new Set(extracted.images)].slice(0, 10);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        searchUrl,
        listings: listings.slice(0, 10),
        extracted,
        htmlLength: html.length,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Listings error: " + err.message }) };
  }
};
