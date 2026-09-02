const STANDARD_60_DAY = [
  'Build out a blog/content strategy targeting your core service keywords',
  'Optimize the Google Business Profile listing (categories, posts, photos)',
  'Establish a consistent Instagram posting cadence',
  'Improve internal linking between related pages',
];
const STANDARD_90_DAY = [
  'Test a Google Ads campaign against your highest-intent keywords',
  'Test a Meta Ads campaign for awareness/retargeting',
  'Run conversion-rate-optimization experiments on the highest-traffic pages',
  'Build dedicated landing pages for top offers',
  'Set up a lead-nurture funnel for form/contact submissions',
];

function buildRoadmap(actionPlan = []) {
  const day30 = actionPlan.filter(a => a.priority === 'high').map(a => a.action);
  const day60FromAudit = actionPlan.filter(a => a.priority === 'medium').map(a => a.action);
  const day90FromAudit = actionPlan.filter(a => a.priority === 'low').map(a => a.action);

  return {
    day30: { fromAudit: day30, standard: [] },
    day60: { fromAudit: day60FromAudit, standard: STANDARD_60_DAY },
    day90: { fromAudit: day90FromAudit, standard: STANDARD_90_DAY },
  };
}

function buildExecutiveSummary(client, digitalScore, sections, actionPlan = []) {
  if (digitalScore.overall == null) {
    return `${client.name}'s digital presence audit is incomplete — not enough data was available to produce an overall score. Connect the missing data sources (see the report) for a full picture.`;
  }
  const breakdown = digitalScore.breakdown;
  const included = Object.entries(breakdown).filter(([, v]) => v.included);
  let strongest = null, weakest = null;
  for (const [key, v] of included) {
    if (!strongest || v.score > strongest[1].score) strongest = [key, v];
    if (!weakest || v.score < weakest[1].score) weakest = [key, v];
  }
  const critical = actionPlan.filter(a => a.priority === 'high').length;
  const label = k => ({ website: 'website health', seo: 'technical SEO', performance: 'performance', content: 'content', social: 'social media', localSeo: 'local SEO', leadGen: 'lead generation' }[k] || k);

  let summary = `${client.name} scores ${digitalScore.overall}/100 overall (${digitalScore.status}).`;
  if (strongest && weakest && strongest[0] !== weakest[0]) {
    summary += ` The strongest area is ${label(strongest[0])} (${strongest[1].score}/100), while ${label(weakest[0])} (${weakest[1].score}/100) needs the most attention.`;
  }
  if (critical > 0) {
    summary += ` Fixing the ${critical} critical issue${critical > 1 ? 's' : ''} identified in this report should be the immediate priority.`;
  } else {
    summary += ` No critical issues were found — the priority now is compounding growth through the opportunities listed below.`;
  }
  return summary;
}

module.exports = { buildRoadmap, buildExecutiveSummary };
