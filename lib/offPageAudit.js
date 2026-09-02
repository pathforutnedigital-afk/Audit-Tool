const fetch = require('node-fetch');

/**
 * There is no free, legitimate source for backlink/domain-authority data — Google doesn't expose
 * it publicly, and every provider (Ahrefs, SEMrush, Moz, Majestic) requires a paid API subscription.
 * This is wired to Moz's Link Explorer API as the cheapest common option; swap the fetch below for
 * whichever provider you subscribe to (Ahrefs and SEMrush have similar REST APIs).
 *
 * Get credentials: https://moz.com/products/api
 */
async function auditOffPage(domain) {
  const accessId = process.env.MOZ_ACCESS_ID;
  const secretKey = process.env.MOZ_SECRET_KEY;
  if (!accessId || !secretKey) {
    return {
      connected: false,
      reason: 'No backlink data provider connected — off-page metrics (domain authority, referring domains, backlink count) require a paid subscription (Moz/Ahrefs/SEMrush). Add MOZ_ACCESS_ID and MOZ_SECRET_KEY to .env once subscribed.',
      findings: [],
    };
  }

  const res = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${accessId}:${secretKey}`).toString('base64'),
    },
    body: JSON.stringify({ targets: [domain] }),
  });
  if (!res.ok) throw new Error(`Moz API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const r = data.results?.[0] || {};

  const findings = [];
  if (r.domain_authority != null && r.domain_authority < 20) {
    findings.push({ severity: 'major', area: 'Off-page', issue: `Domain authority is low (${r.domain_authority}/100) — link-building should be a priority` });
  }

  return {
    connected: true,
    domainAuthority: r.domain_authority ?? null,
    linkingDomains: r.linking_domains ?? null,
    totalBacklinks: r.external_links ?? null,
    findings,
  };
}

module.exports = { auditOffPage };
