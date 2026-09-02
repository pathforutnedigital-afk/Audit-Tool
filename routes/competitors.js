const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/asyncHandler');
const store = require('../lib/clientStore');
const { fetchPage } = require('../lib/fetchPage');
const { auditOnPage, getPageSpeedScores } = require('../lib/seoAudit');
const { auditContent } = require('../lib/contentAudit');
const { computeOverallScore } = require('../lib/scoring');

async function quickAudit(url) {
  const { $, finalUrl } = await fetchPage(url);
  const [onPage, pageSpeed, content] = await Promise.allSettled([
    auditOnPage($, finalUrl),
    getPageSpeedScores(finalUrl),
    auditContent($),
  ]);
  const unwrap = r => (r.status === 'fulfilled' ? r.value : {});
  const op = unwrap(onPage), ps = unwrap(pageSpeed), ct = unwrap(content);
  return {
    url: finalUrl,
    score: computeOverallScore(ps, op),
    seoIssueCount: (op.findings || []).length,
    wordCount: ct.wordCount ?? null,
    performance: ps.performance ?? null,
  };
}

router.post('/:clientId', asyncHandler(async (req, res) => {
  const client = await store.get(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const urls = (req.body?.competitorUrls || client.competitors || []).filter(Boolean).slice(0, 3);
  if (!urls.length) return res.status(400).json({ error: 'No competitor URLs provided' });

  const self = await quickAudit(client.websiteUrl).catch(e => ({ url: client.websiteUrl, error: e.message }));
  const competitors = [];
  for (const u of urls) {
    competitors.push(await quickAudit(u).catch(e => ({ url: u, error: e.message })));
  }

  const notes = [];
  for (const c of competitors) {
    if (c.error) { notes.push(`Could not audit ${c.url}: ${c.error}`); continue; }
    if (c.score != null && self.score != null) {
      if (c.score > self.score + 10) notes.push(`${c.url} scores meaningfully higher overall (${c.score} vs your ${self.score}) — worth a closer look at what they're doing differently.`);
      else if (self.score > c.score + 10) notes.push(`You're ahead of ${c.url} overall (${self.score} vs their ${c.score}).`);
    }
    if (c.wordCount != null && self.wordCount != null && c.wordCount > self.wordCount * 1.5) {
      notes.push(`${c.url} has substantially more page content (${c.wordCount} vs your ${self.wordCount} words) — thin content is easier to outrank with real depth.`);
    }
    if (c.seoIssueCount != null && self.seoIssueCount != null && self.seoIssueCount > c.seoIssueCount + 2) {
      notes.push(`${c.url} has fewer on-page SEO issues (${c.seoIssueCount} vs your ${self.seoIssueCount}) — a quick win to close that gap.`);
    }
  }

  client.competitors = urls;
  client.lastCompetitorReport = { self, competitors, notes, generatedAt: new Date().toISOString() };
  await store.updateClient(client);
  res.json(client.lastCompetitorReport);
}));

module.exports = router;
