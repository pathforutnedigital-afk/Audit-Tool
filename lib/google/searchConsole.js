const fetch = require('node-fetch');

async function listSites(accessToken) {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Search Console site list failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.siteEntry || []).map(s => s.siteUrl);
}

async function getSearchAnalytics(accessToken, siteUrl, { startDate, endDate }) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 10 }),
  });
  if (!res.ok) throw new Error(`Search Console query failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const rows = data.rows || [];
  const totals = rows.reduce((acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }), { clicks: 0, impressions: 0 });

  return {
    totalClicks: totals.clicks,
    totalImpressions: totals.impressions,
    avgCtrPct: totals.impressions ? +((totals.clicks / totals.impressions) * 100).toFixed(2) : null,
    topQueries: rows.map(r => ({
      query: r.keys[0], clicks: r.clicks, impressions: r.impressions,
      ctrPct: +(r.ctr * 100).toFixed(2), avgPosition: +r.position.toFixed(1),
    })),
  };
}

module.exports = { listSites, getSearchAnalytics };
