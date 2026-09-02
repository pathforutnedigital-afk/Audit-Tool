const fetch = require('node-fetch');

/**
 * LinkedIn and TikTok do NOT offer open self-serve access to another business's public
 * follower/engagement stats the way Instagram/X do. To get real numbers for a CLIENT you manage:
 *
 * LinkedIn:
 *  - Apply for the "Community Management API" / Marketing Developer Platform at
 *    https://www.linkedin.com/developers — requires an approved LinkedIn Page admin relationship
 *    per client and a review process (can take days-weeks).
 *  - Once approved: GET https://api.linkedin.com/rest/organizationalEntityShareStatistics
 *    with an OAuth token scoped to that client's Page.
 *
 * TikTok:
 *  - Apply for the TikTok Business API at https://business-api.tiktok.com — also requires
 *    the client to grant access to their TikTok Business account.
 *
 * Both are implemented below as real request shapes so you can drop in credentials once
 * approved — they will throw clearly until then rather than fabricate numbers.
 */

async function fetchLinkedInMetrics({ organizationId, accessToken }) {
  if (!organizationId || !accessToken) {
    throw new Error('LinkedIn not connected for this client — requires an approved Marketing Developer Platform app + Page admin OAuth token');
  }
  const url = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${organizationId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': '202405' },
  });
  if (!res.ok) throw new Error(`LinkedIn API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function fetchTikTokMetrics({ businessId, accessToken }) {
  if (!businessId || !accessToken) {
    throw new Error('TikTok not connected for this client — requires TikTok Business API approval + client-granted access token');
  }
  const url = `https://business-api.tiktok.com/open_api/v1.3/business/get/?business_id=${businessId}`;
  const res = await fetch(url, { headers: { 'Access-Token': accessToken } });
  if (!res.ok) throw new Error(`TikTok API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

module.exports = { fetchLinkedInMetrics, fetchTikTokMetrics };
