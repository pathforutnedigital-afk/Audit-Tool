function computeOverallScore(pageSpeed = {}, onPage = {}) {
  const nums = ['performance', 'seo', 'accessibility', 'bestPractices'].map(k => pageSpeed[k]).filter(n => n != null);
  if (nums.length) return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  const findings = onPage.findings || [];
  const critical = findings.filter(f => f.severity === 'critical').length;
  const major = findings.filter(f => f.severity === 'major').length;
  return Math.max(30, 100 - critical * 15 - major * 6);
}

function computeContentScore(content = {}) {
  const findings = content.findings || [];
  const critical = findings.filter(f => f.severity === 'critical').length;
  const major = findings.filter(f => f.severity === 'major').length;
  return Math.max(30, 100 - critical * 20 - major * 10);
}

function computeSocialScore(social = []) {
  const reachable = social.filter(s => s.reachable !== false).length;
  return Math.round((Math.min(reachable, 5) / 5) * 100);
}

const WEIGHTS = { website: 20, seo: 20, performance: 15, content: 10, social: 15, localSeo: 10, leadGen: 10 };

/**
 * Weighted 0-100 Digital Presence Score. A category with no real data behind it is left out of
 * the calculation entirely and the remaining weights are renormalized — this avoids either
 * fabricating a number for a category we have no signal for, or unfairly zeroing it out.
 */
function computeDigitalPresenceScore(sections) {
  const { pageSpeed = {}, onPage = {}, content = {}, social = [], localSeo = {}, leadGen = {} } = sections;

  const parts = [
    ['website', computeOverallScore(pageSpeed, onPage), WEIGHTS.website],
    ['seo', pageSpeed.seo ?? computeOverallScore(pageSpeed, onPage), WEIGHTS.seo],
    ['performance', pageSpeed.performance ?? null, WEIGHTS.performance],
    ['content', computeContentScore(content), WEIGHTS.content],
    ['social', social.length ? computeSocialScore(social) : null, WEIGHTS.social],
    ['localSeo', localSeo.connected ? localSeo.score : null, WEIGHTS.localSeo],
    ['leadGen', leadGen.score ?? null, WEIGHTS.leadGen],
  ];

  const available = parts.filter(([, v]) => v != null);
  const totalWeight = available.reduce((s, [, , w]) => s + w, 0);
  const weightedSum = available.reduce((s, [, v, w]) => s + v * w, 0);
  const overall = totalWeight ? Math.round(weightedSum / totalWeight) : null;

  const status = overall == null ? null
    : overall >= 85 ? 'Excellent' : overall >= 70 ? 'Good' : overall >= 50 ? 'Average' : 'Poor';

  return {
    overall,
    status,
    breakdown: Object.fromEntries(parts.map(([k, v, w]) => [k, { score: v, weight: w, included: v != null }])),
  };
}

module.exports = { computeOverallScore, computeContentScore, computeSocialScore, computeDigitalPresenceScore };
