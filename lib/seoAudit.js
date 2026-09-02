const fetch = require('node-fetch');

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function getPageSpeedScores(url, strategy = 'mobile') {
  const key = process.env.GOOGLE_PSI_API_KEY;
  const params = new URLSearchParams({ url, strategy });
  if (key) params.set('key', key);
  const qs = params.toString() +
    '&category=performance&category=seo&category=accessibility&category=best-practices';

  const res = await fetch(`${PSI_ENDPOINT}?${qs}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PageSpeed Insights request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const cats = data.lighthouseResult?.categories || {};
  return {
    performance: cats.performance ? Math.round(cats.performance.score * 100) : null,
    seo: cats.seo ? Math.round(cats.seo.score * 100) : null,
    accessibility: cats.accessibility ? Math.round(cats.accessibility.score * 100) : null,
    bestPractices: cats['best-practices'] ? Math.round(cats['best-practices'].score * 100) : null,
  };
}

/** On-page checks: real, live, no external API needed. */
async function auditOnPage($, finalUrl) {
  const title = $('title').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const h1s = $('h1');
  const imgs = $('img');
  const imgsMissingAlt = imgs.filter((_, el) => !$(el).attr('alt') || !$(el).attr('alt').trim()).length;
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const ogTags = $('meta[property^="og:"]').length;
  const twitterTags = $('meta[name^="twitter:"]').length;
  const jsonLd = $('script[type="application/ld+json"]').length;
  const isHttps = finalUrl.startsWith('https://');
  const host = new URL(finalUrl).hostname;
  const internalLinks = $(`a[href^="/"], a[href*="${host}"]`).length;
  const externalLinks = Math.max($('a[href^="http"]').length - internalLinks, 0);

  let robotsOk = false, sitemapOk = false;
  try {
    const origin = new URL(finalUrl).origin;
    const [robotsRes, sitemapRes] = await Promise.all([
      fetch(`${origin}/robots.txt`).catch(() => null),
      fetch(`${origin}/sitemap.xml`).catch(() => null),
    ]);
    robotsOk = !!robotsRes && robotsRes.ok;
    sitemapOk = !!sitemapRes && sitemapRes.ok;
  } catch (_) { /* ignore */ }

  const findings = [];
  if (!title) findings.push({ severity: 'critical', area: 'On-page', issue: 'Missing <title> tag' });
  else if (title.length > 60) findings.push({ severity: 'minor', area: 'On-page', issue: `Title is ${title.length} chars (over ~60 gets truncated in search results)` });
  if (!metaDescription) findings.push({ severity: 'major', area: 'On-page', issue: 'Missing meta description' });
  else if (metaDescription.length > 160) findings.push({ severity: 'minor', area: 'On-page', issue: `Meta description is ${metaDescription.length} chars (over ~160 gets truncated)` });
  if (h1s.length === 0) findings.push({ severity: 'major', area: 'On-page', issue: 'No H1 heading found' });
  if (h1s.length > 1) findings.push({ severity: 'minor', area: 'On-page', issue: `${h1s.length} H1 tags found (should be exactly 1)` });
  if (imgsMissingAlt > 0) findings.push({ severity: 'major', area: 'Accessibility', issue: `${imgsMissingAlt} of ${imgs.length} images missing alt text` });
  if (!viewport) findings.push({ severity: 'critical', area: 'On-page', issue: 'No mobile viewport meta tag — page likely not mobile-responsive' });
  if (!canonical) findings.push({ severity: 'minor', area: 'On-page', issue: 'No canonical URL set' });
  if (!isHttps) findings.push({ severity: 'critical', area: 'On-page', issue: 'Site not served over HTTPS' });
  if (ogTags === 0) findings.push({ severity: 'major', area: 'On-page', issue: 'No Open Graph tags — links look broken/plain when shared on Facebook, LinkedIn, etc.' });
  if (twitterTags === 0) findings.push({ severity: 'minor', area: 'On-page', issue: 'No Twitter Card tags' });
  if (jsonLd === 0) findings.push({ severity: 'minor', area: 'On-page', issue: 'No structured data (JSON-LD) found — missing rich-result eligibility' });
  if (!robotsOk) findings.push({ severity: 'minor', area: 'On-page', issue: 'robots.txt not found or not accessible' });
  if (!sitemapOk) findings.push({ severity: 'minor', area: 'On-page', issue: 'sitemap.xml not found at the default path' });

  return {
    url: finalUrl, title, metaDescription,
    h1Count: h1s.length, imageCount: imgs.length, imagesMissingAlt: imgsMissingAlt,
    hasViewport: !!viewport, hasCanonical: !!canonical, isHttps,
    openGraphTags: ogTags, twitterCardTags: twitterTags, structuredDataBlocks: jsonLd,
    robotsTxtFound: robotsOk, sitemapFound: sitemapOk,
    internalLinks, externalLinks,
    findings,
  };
}

module.exports = { auditOnPage, getPageSpeedScores };
