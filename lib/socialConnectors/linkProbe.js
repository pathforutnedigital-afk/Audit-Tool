const cheerio = require('cheerio');
const fetch = require('node-fetch');
const { assertSafeUrl } = require('../urlSafety');

function detectPlatform(url) {
  const host = new URL(url).hostname.replace('www.', '');
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('facebook.com')) return 'facebook';
  if (host.includes('x.com') || host.includes('twitter.com')) return 'x';
  if (host.includes('linkedin.com')) return 'linkedin';
  if (host.includes('tiktok.com')) return 'tiktok';
  if (host.includes('youtube.com')) return 'youtube';
  if (host.includes('pinterest.com')) return 'pinterest';
  return host;
}

/**
 * Fetches the profile URL server-side and reads whatever public preview metadata the platform
 * serves to crawlers (Open Graph tags). This works without login or API keys, BUT most platforms
 * (Instagram, Facebook, LinkedIn, TikTok especially) deliberately serve a stripped-down page to
 * non-browser requests and will NOT include real follower/engagement counts here — that data is
 * only available through each platform's official API with proper auth (see
 * lib/socialConnectors/instagram.js, twitter.js, restricted.js for the real-number path).
 * What this DOES reliably get: display name, bio/description, and profile image — useful for
 * confirming the account exists, is active, and is branded consistently.
 */
async function probeSocialLink(url) {
  const platform = detectPlatform(url);
  try {
    await assertSafeUrl(url);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'facebookexternalhit/1.1' }, // many platforms serve richer OG tags to known crawler UAs
      redirect: 'follow',
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').first().text().trim();
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';

    return {
      platform,
      url,
      reachable: res.ok,
      displayName: ogTitle || null,
      bio: ogDescription || null,
      profileImage: ogImage || null,
      note: 'Follower/engagement counts require official API credentials for this platform — see README.',
    };
  } catch (e) {
    return { platform, url, reachable: false, error: e.message };
  }
}

module.exports = { probeSocialLink, detectPlatform };
