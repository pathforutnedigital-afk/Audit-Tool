const fetch = require('node-fetch');

/**
 * SETUP: Google Cloud Console -> enable "Places API" -> create an API key (can be restricted
 * to Places API only). Set GOOGLE_PLACES_API_KEY in .env. This is public listing data (rating,
 * review count, address, hours) — no OAuth or business ownership needed, unlike Search
 * Console/GA4 in lib/google/oauth.js.
 */
async function auditLocalSeo(businessName) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return { connected: false, reason: 'Local SEO not connected — add GOOGLE_PLACES_API_KEY to .env (Google Cloud Console → enable Places API).', findings: [] };
  }

  const findRes = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(businessName)}&inputtype=textquery&fields=place_id&key=${key}`);
  const findData = await findRes.json();
  const placeId = findData.candidates?.[0]?.place_id;
  if (!placeId) {
    return { connected: false, reason: `No Google Business listing found for "${businessName}" — it may not be verified/claimed, or the name doesn't match closely enough.`, findings: [] };
  }

  const fields = 'name,rating,user_ratings_total,formatted_address,formatted_phone_number,types,opening_hours,photos';
  const detailsRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${key}`);
  const detailsData = await detailsRes.json();
  const p = detailsData.result || {};

  const checks = [
    { label: 'Has customer reviews', ok: (p.user_ratings_total || 0) > 0, major: false },
    { label: 'Rating 4.0+', ok: (p.rating || 0) >= 4, major: false },
    { label: '20+ reviews', ok: (p.user_ratings_total || 0) >= 20, major: true },
    { label: 'Phone number listed', ok: !!p.formatted_phone_number, major: true },
    { label: 'Business hours listed', ok: !!p.opening_hours, major: false },
    { label: 'Photos present', ok: (p.photos || []).length > 0, major: false },
  ];
  const passed = checks.filter(c => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const findings = checks.filter(c => !c.ok).map(c => ({
    severity: c.major ? 'major' : 'minor', area: 'Local SEO', issue: `Missing: ${c.label}`,
  }));

  return {
    connected: true,
    name: p.name || businessName,
    rating: p.rating ?? null,
    reviewCount: p.user_ratings_total ?? null,
    address: p.formatted_address ?? null,
    phone: p.formatted_phone_number ?? null,
    categories: p.types || [],
    hasHours: !!p.opening_hours,
    photoCount: (p.photos || []).length,
    score,
    findings,
  };
}

module.exports = { auditLocalSeo };
