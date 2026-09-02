const fetch = require('node-fetch');

/**
 * SETUP REQUIRED (one-time, per agency, not per client):
 * 1. Create a Meta app at https://developers.facebook.com/apps
 * 2. Add the "Instagram Graph API" product.
 * 3. Each client's Instagram must be a Business or Creator account linked to a Facebook Page.
 * 4. Generate a long-lived access token for that Page (Meta's token debugger/Graph API Explorer).
 * 5. Store per-client as { igUserId, accessToken } — pass into fetchInstagramMetrics below.
 *
 * Without a real igUserId + accessToken this will throw — that's intentional, it never returns fake data.
 */
async function fetchInstagramMetrics({ igUserId, accessToken }) {
  if (!igUserId || !accessToken) {
    throw new Error('Instagram not connected for this client — missing igUserId/accessToken');
  }
  const fields = 'username,followers_count,follows_count,media_count,biography,profile_picture_url';
  const url = `https://graph.facebook.com/v19.0/${igUserId}?fields=${fields}&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram API error (${res.status}): ${body.slice(0, 300)}`);
  }
  const profile = await res.json();

  const mediaUrl = `https://graph.facebook.com/v19.0/${igUserId}/media?fields=like_count,comments_count,timestamp&limit=12&access_token=${accessToken}`;
  const mediaRes = await fetch(mediaUrl);
  const media = mediaRes.ok ? (await mediaRes.json()).data || [] : [];

  const avgLikes = media.length ? media.reduce((s, m) => s + (m.like_count || 0), 0) / media.length : 0;
  const avgComments = media.length ? media.reduce((s, m) => s + (m.comments_count || 0), 0) / media.length : 0;
  const engagementRate = profile.followers_count
    ? +(((avgLikes + avgComments) / profile.followers_count) * 100).toFixed(2)
    : null;

  const daysSinceLastPost = media.length
    ? Math.floor((Date.now() - new Date(media[0].timestamp).getTime()) / 86400000)
    : null;

  return {
    platform: 'instagram',
    username: profile.username,
    followers: profile.followers_count,
    following: profile.follows_count,
    postCount: profile.media_count,
    recentPostsAnalyzed: media.length,
    avgLikesPerPost: Math.round(avgLikes),
    avgCommentsPerPost: Math.round(avgComments),
    engagementRatePct: engagementRate,
    daysSinceLastPost,
  };
}

module.exports = { fetchInstagramMetrics };
