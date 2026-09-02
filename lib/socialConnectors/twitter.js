const fetch = require('node-fetch');

/**
 * SETUP REQUIRED:
 * 1. Create a project/app at https://developer.x.com (paid tier needed for most useful endpoints
 *    as of the API v2 pricing changes — the free tier is very restricted on read access).
 * 2. Generate a Bearer Token (App-only auth is enough for public metrics).
 * 3. Store in .env as X_BEARER_TOKEN, or pass a per-client token if the agency manages multiple apps.
 */
async function fetchTwitterMetrics({ username, bearerToken }) {
  const token = bearerToken || process.env.X_BEARER_TOKEN;
  if (!username || !token) {
    throw new Error('X/Twitter not connected for this client — missing username/bearerToken');
  }
  const url = `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics,description,created_at`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API error (${res.status}): ${body.slice(0, 300)}`);
  }
  const { data } = await res.json();
  const m = data.public_metrics || {};
  return {
    platform: 'x',
    username: data.username,
    followers: m.followers_count,
    following: m.following_count,
    postCount: m.tweet_count,
    listedCount: m.listed_count,
    accountCreated: data.created_at,
  };
}

module.exports = { fetchTwitterMetrics };
