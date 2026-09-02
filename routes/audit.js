const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/asyncHandler');
const store = require('../lib/clientStore');
const { checkAndIncrement } = require('../lib/rateLimit');
const { fetchPage } = require('../lib/fetchPage');
const { auditOnPage, getPageSpeedScores } = require('../lib/seoAudit');
const { auditColors } = require('../lib/colorAudit');
const { auditContent } = require('../lib/contentAudit');
const { auditImages } = require('../lib/imageAudit');
const { auditOffPage } = require('../lib/offPageAudit');
const { auditTraffic } = require('../lib/trafficAudit');
const { auditLeadGen } = require('../lib/leadGenAudit');
const { auditLocalSeo } = require('../lib/google/places');
const { probeSocialLink } = require('../lib/socialConnectors/linkProbe');
const { fetchInstagramMetrics } = require('../lib/socialConnectors/instagram');
const { fetchTwitterMetrics } = require('../lib/socialConnectors/twitter');
const googleOAuth = require('../lib/google/oauth');
const searchConsoleLib = require('../lib/google/searchConsole');
const analyticsLib = require('../lib/google/analytics');
const { generateSwot } = require('../lib/swotEngine');
const { computeDigitalPresenceScore } = require('../lib/scoring');
const { buildRoadmap, buildExecutiveSummary } = require('../lib/reportNarrative');

router.post('/:clientId', asyncHandler(async (req, res) => {
  const client = await store.get(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const rlKey = `audit:${req.ip || 'anon'}`;
  const allowed = await checkAndIncrement(rlKey, 10, 60 * 60 * 1000); // 10 audits/hour per IP
  if (!allowed) return res.status(429).json({ error: 'Rate limit reached — max 10 audits per hour. Try again later.' });

  let page;
  try {
    page = await fetchPage(client.websiteUrl);
  } catch (e) {
    return res.status(502).json({ error: `Could not reach ${client.websiteUrl}: ${e.message}` });
  }
  const { $, html, finalUrl } = page;
  const domain = new URL(finalUrl).hostname;

  const [onPage, pageSpeed, color, content, images, offPage, traffic] = await Promise.allSettled([
    auditOnPage($, finalUrl),
    getPageSpeedScores(finalUrl),
    auditColors($, finalUrl),
    auditContent($),
    auditImages($, finalUrl),
    auditOffPage(domain),
    auditTraffic(domain),
  ]);
  const unwrap = (r, fallback = {}) => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message, ...fallback });

  const leadGen = auditLeadGen($, html);
  const localSeo = await auditLocalSeo(client.name).catch(e => ({ connected: false, reason: e.message, findings: [] }));

  const social = [];
  for (const link of client.socialLinks || []) {
    social.push(await probeSocialLink(link).catch(e => ({ url: link, reachable: false, error: e.message })));
  }
  if (client.social?.instagram) {
    try { social.push(await fetchInstagramMetrics(client.social.instagram)); }
    catch (e) { social.push({ platform: 'instagram', reachable: false, error: e.message }); }
  }
  if (client.social?.x) {
    try { social.push(await fetchTwitterMetrics(client.social.x)); }
    catch (e) { social.push({ platform: 'x', reachable: false, error: e.message }); }
  }

  let googleSearch = { connected: false, reason: 'Google not connected — connect it from this client\'s settings.' };
  let gaTraffic = null;
  if (client.google?.refreshToken) {
    try {
      const { access_token } = await googleOAuth.refreshAccessToken(client.google.refreshToken);
      if (client.google.searchConsoleSite) {
        const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 28);
        const fmt = d => d.toISOString().slice(0, 10);
        const sc = await searchConsoleLib.getSearchAnalytics(access_token, client.google.searchConsoleSite, { startDate: fmt(start), endDate: fmt(end) });
        googleSearch = { connected: true, source: 'Google Search Console', periodDays: 28, ...sc };
      } else {
        googleSearch = { connected: false, reason: 'Connected to Google, but no Search Console property selected yet.' };
      }
      if (client.google.ga4PropertyId) {
        gaTraffic = await analyticsLib.getReport(access_token, client.google.ga4PropertyId);
      }
    } catch (e) {
      googleSearch = { connected: false, reason: `Google data fetch failed: ${e.message}` };
    }
  }

  const sections = {
    onPage: unwrap(onPage),
    pageSpeed: unwrap(pageSpeed),
    color: unwrap(color),
    content: unwrap(content),
    images: unwrap(images),
    offPage: unwrap(offPage, { connected: false }),
    traffic: gaTraffic || unwrap(traffic, { connected: false }),
    googleSearch,
    leadGen,
    localSeo,
    social,
  };

  const report = generateSwot(sections);
  const digitalScore = computeDigitalPresenceScore(sections);
  const roadmap = buildRoadmap(report.actionPlan);
  const executiveSummary = buildExecutiveSummary(client, digitalScore, sections, report.actionPlan);

  const result = {
    url: finalUrl, generatedAt: new Date().toISOString(),
    ...sections, ...report,
    digitalScore, roadmap, executiveSummary,
  };

  await store.saveAuditResult(client.id, result);
  res.json(result);
}));

module.exports = router;
