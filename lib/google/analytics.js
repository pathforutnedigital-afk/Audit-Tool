const fetch = require('node-fetch');

async function listProperties(accessToken) {
  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GA4 property list failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const props = [];
  for (const acc of data.accountSummaries || []) {
    for (const p of acc.propertySummaries || []) {
      props.push({ propertyId: p.property.replace('properties/', ''), displayName: p.displayName });
    }
  }
  return props;
}

async function getReport(accessToken, propertyId, { startDate = '28daysAgo', endDate = 'today' } = {}) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
    }),
  });
  if (!res.ok) throw new Error(`GA4 report failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const rows = data.rows || [];
  const bySource = rows.map(r => ({
    channel: r.dimensionValues[0].value,
    sessions: +r.metricValues[0].value,
    users: +r.metricValues[1].value,
    pageviews: +r.metricValues[2].value,
  }));
  const totals = bySource.reduce((acc, r) => ({
    sessions: acc.sessions + r.sessions, users: acc.users + r.users, pageviews: acc.pageviews + r.pageviews,
  }), { sessions: 0, users: 0, pageviews: 0 });

  return { ...totals, bySource, source: 'Google Analytics (GA4)', periodDays: 28 };
}

module.exports = { listProperties, getReport };
