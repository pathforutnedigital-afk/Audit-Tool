const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/asyncHandler');
const store = require('../lib/clientStore');

router.get('/stats', asyncHandler(async (req, res) => {
  const clients = await store.list();
  const audited = clients.filter(c => c.lastAudit);
  const scores = audited.map(c => c.lastAudit.digitalScore?.overall).filter(s => s != null);
  const totalAudits = clients.reduce((sum, c) => sum + (c.auditHistory?.length || 0), 0);
  const criticalIssues = audited.reduce((sum, c) => sum + (c.lastAudit.actionPlan || []).filter(a => a.priority === 'high').length, 0);

  const industries = {};
  for (const c of clients) industries[c.industry || 'Unspecified'] = (industries[c.industry || 'Unspecified'] || 0) + 1;
  const topIndustries = Object.entries(industries).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  const recentAudits = audited
    .map(c => ({ id: c.id, name: c.name, date: c.lastAudit.generatedAt, score: c.lastAudit.digitalScore?.overall ?? null }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  res.json({
    totalClients: clients.length,
    totalAudits,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    criticalIssues,
    topIndustries,
    recentAudits,
  });
}));

module.exports = router;
