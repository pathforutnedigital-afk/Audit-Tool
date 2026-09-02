const fetch = require('node-fetch');

/**
 * "Traffic" for a site you don't own can only come from an estimator (SimilarWeb, paid) since
 * Google Analytics data is private to the site owner. Two real paths, pick based on the client:
 *
 * OPTION A — client owns the site and grants you access (most accurate, free):
 *   Use Google Analytics Data API (GA4). Client adds your service account as a Viewer on their
 *   GA4 property, then call:
 *   https://developers.google.com/analytics/devguides/reporting/data/v1
 *
 * OPTION B — estimating a competitor's or prospect's traffic (no access needed, paid):
 *   SimilarWeb API — https://www.similarweb.com/corp/developer/
 *
 * This stub implements Option B's request shape. Wire in GA4 similarly once you have a client's
 * property ID + service account credentials.
 */
async function auditTraffic(domain) {
  const apiKey = process.env.SIMILARWEB_API_KEY;
  if (!apiKey) {
    return {
      connected: false,
      reason: 'No traffic data source connected. For an owned client site, the accurate free route is Google Analytics (GA4) with the client granting you Viewer access. For estimating a site you don\'t own, SIMILARWEB_API_KEY (paid) can be added to .env.',
      findings: [],
    };
  }

  const res = await fetch(`https://api.similarweb.com/v1/website/${domain}/total-traffic-and-engagement/visits?api_key=${apiKey}&start_date=2026-06&end_date=2026-08&country=world&granularity=monthly&main_domain_only=false`);
  if (!res.ok) throw new Error(`SimilarWeb API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();

  return {
    connected: true,
    monthlyVisits: data.visits || null,
    findings: [],
  };
}

module.exports = { auditTraffic };
