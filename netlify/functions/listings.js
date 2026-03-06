// Netlify Serverless Function — Nation Realtor Scraper
// Fetches real listings from nationrealtor.axenrealty.com

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
    // Build search URL from parameters
    const params = new URLSearchParams();
    if (body.location) params.set('location', body.location);
    if (body.minPrice) params.set('minPrice', body.minPrice);
    if (body.maxPrice) params.set('maxPrice', body.maxPrice);
    if (body.beds) params.set('beds', body.beds);
    if (body.baths) params.set('baths', body.baths);
    if (body.type) params.set('type', body.type);

    // Construct the URL (try multiple URL patterns the site may use)
    const baseUrl = 'https://nationrealtor.axenrealty.com';
    const searchUrl = body.searchUrl || `${baseUrl}/search?${params.toString()}`;

    // Also try direct address lookup if specific address provided
    const urls = [searchUrl];
    if (body.address) {
      urls.push(`${baseUrl}/search?q=${encodeURIComponent(body.address)}`);
      urls.push(`${baseUrl}/search?location=${encodeURIComponent(body.address)}`);
    }

    let html = '';
    let finalUrl = '';

    // Try each URL until one works
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        if (res.ok) {
          html = await res.text();
          finalUrl = url;
          break;
        }
      } catch (e) { continue; }
    }

    if (!html) {
      return { statusCode: 200, headers, body: JSON.stringify({ searchUrl, listings: [], error: "Could not fetch listings page" }) };
    }

    // Extract listing data from HTML using regex patterns
    // Look for common IDX/MLS listing patterns in the HTML
    const listings = [];

    // Pattern 1: JSON-LD structured data
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
    for (const match of jsonLdMatches) {
      try {
        const jsonStr = match.replace(/<\/?script[^>]*>/gi, '');
        const data = JSON.parse(jsonStr);
        if (data['@type'] === 'RealEstateListing' || data['@type'] === 'Product' || data['@type'] === 'Residence') {
          listings.push({
            title: data.name || data.address?.streetAddress || '',
            price: data.offers?.price || data.price || '',
            address: data.address ? `${data.address.streetAddress}, ${data.address.addressLocality}, ${data.address.addressRegion} ${data.address.postalCode}` : '',
            url: data.url || finalUrl,
            image: data.image || '',
            beds: data.numberOfBedrooms || '',
            baths: data.numberOfBathroomsTotal || data.numberOfFullBathrooms || '',
            sqft: data.floorSize?.value || '',
            description: data.description || '',
          });
        }
      } catch (e) { /* skip invalid JSON */ }
    }

    // Pattern 2: Common listing card patterns in HTML
    // Look for price patterns
    const pricePattern = /\$[\d,]+(?:\.\d{2})?/g;
    const addressPattern = /\d+\s+[\w\s]+(?:St|Ave|Blvd|Rd|Dr|Ln|Ct|Way|Pl|Cir|Ter|Pkwy|Street|Avenue|Boulevard|Road|Drive|Lane|Court)[,.\s]+[\w\s]+,\s*[A-Z]{2}\s+\d{5}/gi;

    const prices = [...new Set((html.match(pricePattern) || []))].filter(p => {
      const num = parseInt(p.replace(/[$,]/g, ''));
      return num > 50000 && num < 50000000; // Reasonable property price range
    });

    const addresses = [...new Set((html.match(addressPattern) || []))];

    // Pattern 3: Look for listing URLs within the page
    const listingUrlPattern = /href="([^"]*(?:listing|property|detail)[^"]*)"/gi;
    const listingUrls = [];
    let urlMatch;
    while ((urlMatch = listingUrlPattern.exec(html)) !== null) {
      let lUrl = urlMatch[1];
      if (lUrl.startsWith('/')) lUrl = baseUrl + lUrl;
      listingUrls.push(lUrl);
    }

    // Pattern 4: Look for image URLs
    const imgPattern = /(?:src|data-src)="(https?:\/\/[^"]*(?:photo|image|listing|property|mls|upload)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    const images = [];
    let imgMatch;
    while ((imgMatch = imgPattern.exec(html)) !== null) {
      images.push(imgMatch[1]);
    }

    // Pattern 5: Meta tags and Open Graph data
    const ogTitle = (html.match(/property="og:title"\s+content="([^"]+)"/) || [])[1] || '';
    const ogDesc = (html.match(/property="og:description"\s+content="([^"]+)"/) || [])[1] || '';
    const ogImage = (html.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || '';

    // Build extracted data summary
    const extracted = {
      addresses: addresses.slice(0, 10),
      prices: prices.slice(0, 10),
      listingUrls: listingUrls.slice(0, 10),
      images: images.slice(0, 10),
      ogTitle, ogDesc, ogImage,
      pageTitle: (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '',
    };

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        searchUrl: finalUrl,
        listings: listings.slice(0, 10),
        extracted,
        htmlLength: html.length,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Listings error: " + err.message }) };
  }
};
