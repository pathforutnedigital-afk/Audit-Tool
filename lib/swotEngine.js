const priorityOrder = { high: 0, medium: 1, low: 2 };

function pushFromFindings(findings, weaknesses, actions) {
  for (const f of findings || []) {
    if (f.severity === 'critical') { weaknesses.push(f.issue); actions.push({ priority: 'high', area: f.area, action: `Fix now: ${f.issue}` }); }
    else if (f.severity === 'major') { weaknesses.push(f.issue); actions.push({ priority: 'medium', area: f.area, action: f.issue }); }
    else { actions.push({ priority: 'low', area: f.area, action: f.issue }); }
  }
}

/**
 * sections: { pageSpeed, onPage, color, content, images, offPage, traffic, social }
 * social is an array of probed/connected platform results.
 */
function generateSwot(sections) {
  const strengths = [], weaknesses = [], opportunities = [], threats = [];
  const actions = [];

  const { pageSpeed = {}, onPage = {}, color = {}, content = {}, images = {}, offPage = {}, traffic = {}, social = [] } = sections;

  // Performance
  if (pageSpeed.performance != null) {
    if (pageSpeed.performance >= 80) strengths.push(`Fast site: PageSpeed performance score ${pageSpeed.performance}/100`);
    else if (pageSpeed.performance < 50) { weaknesses.push(`Slow site: performance score ${pageSpeed.performance}/100`); actions.push({ priority: 'high', area: 'Performance', action: 'Fix render-blocking resources and unoptimized assets flagged by PageSpeed.' }); }
  }
  if (pageSpeed.accessibility != null && pageSpeed.accessibility < 70) {
    weaknesses.push(`Accessibility score ${pageSpeed.accessibility}/100`);
    actions.push({ priority: 'medium', area: 'Accessibility', action: 'Address contrast, ARIA, and alt-text gaps — reduces legal exposure too.' });
  }

  // On-page
  pushFromFindings(onPage.findings, weaknesses, actions);
  if ((onPage.findings || []).filter(f => f.severity !== 'minor').length === 0) strengths.push('No critical/major on-page SEO issues detected');
  if (onPage.structuredDataBlocks === 0) opportunities.push('Add structured data (Product, Article, LocalBusiness, FAQ schema) to unlock rich results.');
  if (onPage.openGraphTags === 0) opportunities.push('Adding Open Graph tags will make social shares look intentional instead of a bare link.');

  // Off-page
  if (!offPage.connected) opportunities.push('Off-page metrics (domain authority, backlinks) not connected — worth subscribing to a backlink tool to see where you stand vs. competitors.');
  else pushFromFindings(offPage.findings, weaknesses, actions);

  // Traffic
  if (!traffic.connected) opportunities.push('Traffic data not connected — connecting Google Analytics (free, if you own the site) would show real visitor volume and sources.');
  else if (traffic.sessions != null) strengths.push(`${traffic.source || 'Analytics'}: ${traffic.sessions.toLocaleString()} sessions in the last ${traffic.periodDays || 28} days`);
  else if (traffic.monthlyVisits) strengths.push(`Estimated monthly visits: ${traffic.monthlyVisits.toLocaleString()}`);

  // Google Search Console
  const googleSearch = sections.googleSearch || {};
  if (!googleSearch.connected) {
    if (googleSearch.reason) opportunities.push(googleSearch.reason);
  } else {
    strengths.push(`Search Console: ${googleSearch.totalClicks?.toLocaleString() ?? 0} clicks, ${googleSearch.totalImpressions?.toLocaleString() ?? 0} impressions over the last ${googleSearch.periodDays} days`);
    if (googleSearch.avgCtrPct != null && googleSearch.avgCtrPct < 2) {
      weaknesses.push(`Search CTR is low (${googleSearch.avgCtrPct}%) relative to impressions — titles/descriptions may not be compelling enough to click`);
      actions.push({ priority: 'medium', area: 'SEO', action: 'Rewrite meta titles/descriptions for top-impression, low-CTR queries in Search Console.' });
    }
  }

  // Color
  pushFromFindings(color.findings, weaknesses, actions);
  if (color.palette?.length >= 2 && color.palette.length <= 4) strengths.push('Tight, consistent color palette in use across the site');

  // Content
  pushFromFindings(content.findings, weaknesses, actions);
  if (content.wordCount >= 600) strengths.push(`Substantial page content: ${content.wordCount} words`);

  // Images
  pushFromFindings(images.findings, weaknesses, actions);

  // Social
  const platforms = social.map(s => s.platform);
  const missing = ['instagram', 'facebook', 'x', 'linkedin', 'tiktok'].filter(p => !platforms.includes(p));
  if (missing.length) opportunities.push(`No linked presence on: ${missing.join(', ')}. Worth a deliberate decision to claim or skip each.`);
  for (const s of social) {
    if (s.reachable === false) { weaknesses.push(`${s.platform} link is unreachable or the profile may not exist at that URL`); actions.push({ priority: 'high', area: 'Social', action: `Verify the ${s.platform} link — it did not resolve.` }); }
    if (s.engagementRatePct != null) {
      if (s.engagementRatePct < 1) { weaknesses.push(`${s.platform}: engagement rate ${s.engagementRatePct}% (healthy is typically 1–3%+)`); actions.push({ priority: 'medium', area: 'Social', action: `Rework ${s.platform} content mix — low engagement is usually a format/hook problem, not audience size.` }); }
      else if (s.engagementRatePct >= 3) strengths.push(`${s.platform}: strong engagement at ${s.engagementRatePct}%`);
    }
    if (s.daysSinceLastPost != null && s.daysSinceLastPost > 30) { weaknesses.push(`${s.platform}: no post in ${s.daysSinceLastPost} days`); actions.push({ priority: 'high', area: 'Social', action: `Resume posting on ${s.platform} — the account currently looks abandoned.` }); }
    if (s.followers != null && s.followers > 10000) strengths.push(`${s.platform}: established audience of ${s.followers.toLocaleString()} followers`);
  }

  threats.push('Search and social algorithms change frequently — rankings and reach built today can erode without ongoing maintenance.');
  threats.push('Competitors actively investing in SEO/content and social will out-pace a stagnant presence over time.');

  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    swot: { strengths, weaknesses, opportunities, threats },
    actionPlan: actions,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateSwot };
