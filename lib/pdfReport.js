const PDFDocument = require('pdfkit');

const BRAND = '#186DB6';
const NAVY = '#12233B';
const SLATE = '#64748B';
const LINE = '#E2E8F0';

function sectionTitle(doc, text) {
  doc.moveDown(0.6);
  doc.fontSize(15).fillColor(NAVY).font('Helvetica-Bold').text(text);
  doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor(LINE).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fillColor(NAVY).fontSize(10.5);
}

function bulletList(doc, items, empty = 'None.') {
  if (!items.length) { doc.fillColor(SLATE).text(empty); doc.fillColor(NAVY); return; }
  for (const item of items) doc.text(`•  ${item}`, { indent: 10 });
}

function keyValueTable(doc, rows) {
  for (const [k, v] of rows) {
    doc.font('Helvetica-Bold').text(k, { continued: true, width: 180 });
    doc.font('Helvetica').text(`  ${v}`);
  }
}

/**
 * Streams a branded PDF report for a client directly to the HTTP response.
 * Expects client.lastAudit, client.digitalScore-equivalent (r.digitalScore), and
 * client.lastCompetitorReport (optional) to already be populated.
 */
function streamReportPdf(client, res) {
  const r = client.lastAudit || {};
  const ds = r.digitalScore || { overall: null, status: null, breakdown: {} };

  const doc = new PDFDocument({ margin: 54, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${client.name.replace(/[^a-z0-9]+/gi, '-')}-audit-report.pdf"`);
  doc.pipe(res);

  // ---- Cover page ----
  doc.fontSize(11).fillColor(BRAND).font('Helvetica-Bold').text('PATHFORTUNE DIGITAL MEDIA', { align: 'center' });
  doc.moveDown(6);
  doc.fontSize(28).fillColor(NAVY).text(client.name, { align: 'center' });
  doc.fontSize(12).fillColor(SLATE).font('Helvetica').text(client.websiteUrl, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10.5).text(`Audit date: ${new Date(r.generatedAt || Date.now()).toLocaleDateString()}`, { align: 'center' });
  if (ds.overall != null) {
    doc.moveDown(2.5);
    doc.fontSize(56).fillColor(BRAND).font('Helvetica-Bold').text(`${ds.overall}`, { align: 'center', continued: false });
    doc.fontSize(16).fillColor(SLATE).font('Helvetica').text(`out of 100 — ${ds.status}`, { align: 'center' });
  }
  doc.moveDown(3);
  doc.fontSize(9).fillColor(SLATE).text('Prepared by Pathfortune Digital Media', { align: 'center' });

  // ---- Executive summary ----
  doc.addPage();
  sectionTitle(doc, 'Executive Summary');
  doc.fontSize(11).text(r.executiveSummary || 'No summary available.', { align: 'left' });

  // ---- Digital Presence Score breakdown ----
  sectionTitle(doc, 'Digital Presence Score Breakdown');
  const labels = { website: 'Website Health (20%)', seo: 'Technical SEO (20%)', performance: 'Performance (15%)', content: 'Content (10%)', social: 'Social Media (15%)', localSeo: 'Local SEO (10%)', leadGen: 'Lead Generation (10%)' };
  keyValueTable(doc, Object.entries(ds.breakdown || {}).map(([k, v]) => [labels[k] || k, v.included ? `${v.score}/100` : 'Not available']));

  // ---- Website / on-page SEO ----
  doc.addPage();
  sectionTitle(doc, 'Website & Technical SEO');
  const o = r.onPage || {};
  keyValueTable(doc, [
    ['Title', o.title || '—'],
    ['Meta description', o.metaDescription || '—'],
    ['HTTPS', o.isHttps ? 'Yes' : 'No'],
    ['Mobile viewport', o.hasViewport ? 'Yes' : 'No'],
    ['Structured data blocks', o.structuredDataBlocks ?? '—'],
  ]);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('Findings');
  doc.font('Helvetica');
  bulletList(doc, (o.findings || []).map(f => `[${f.severity.toUpperCase()}] ${f.issue}`));

  // ---- Performance ----
  sectionTitle(doc, 'Performance');
  const ps = r.pageSpeed || {};
  keyValueTable(doc, [
    ['Performance', ps.performance ?? 'Not available'],
    ['SEO', ps.seo ?? 'Not available'],
    ['Accessibility', ps.accessibility ?? 'Not available'],
    ['Best Practices', ps.bestPractices ?? 'Not available'],
  ]);

  // ---- Social ----
  doc.addPage();
  sectionTitle(doc, 'Social Media Audit');
  bulletList(doc, (r.social || []).map(s => `${s.platform}: ${s.displayName || s.url} ${s.followers != null ? `— ${s.followers.toLocaleString()} followers` : ''}`), 'No social links added.');

  // ---- Local SEO ----
  sectionTitle(doc, 'Local SEO / Google Business Profile');
  const ls = r.localSeo || {};
  if (ls.connected) {
    keyValueTable(doc, [['Rating', ls.rating ?? '—'], ['Reviews', ls.reviewCount ?? '—'], ['Phone listed', ls.phone ? 'Yes' : 'No'], ['Hours listed', ls.hasHours ? 'Yes' : 'No']]);
  } else {
    doc.fillColor(SLATE).text(ls.reason || 'Not connected.'); doc.fillColor(NAVY);
  }

  // ---- Lead Generation ----
  sectionTitle(doc, 'Lead Generation Audit');
  const lg = r.leadGen || {};
  doc.text(`Lead Generation Score: ${lg.score ?? '—'}/100`);
  bulletList(doc, (lg.findings || []).map(f => f.issue));

  // ---- Competitors ----
  if (client.lastCompetitorReport) {
    doc.addPage();
    sectionTitle(doc, 'Competitor Comparison');
    const cr = client.lastCompetitorReport;
    keyValueTable(doc, [[client.name, `${cr.self.score ?? '—'}/100`], ...cr.competitors.map(c => [c.url, `${c.score ?? '—'}/100`])]);
    doc.moveDown(0.5);
    bulletList(doc, cr.notes);
  }

  // ---- SWOT ----
  doc.addPage();
  sectionTitle(doc, 'SWOT Analysis');
  const swot = r.swot || { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  for (const [label, key] of [['Strengths', 'strengths'], ['Weaknesses', 'weaknesses'], ['Opportunities', 'opportunities'], ['Threats', 'threats']]) {
    doc.font('Helvetica-Bold').text(label); doc.font('Helvetica');
    bulletList(doc, swot[key]);
    doc.moveDown(0.3);
  }

  // ---- 30/60/90 plan ----
  doc.addPage();
  sectionTitle(doc, '30 / 60 / 90 Day Action Plan');
  const roadmap = r.roadmap || { day30: { fromAudit: [], standard: [] }, day60: { fromAudit: [], standard: [] }, day90: { fromAudit: [], standard: [] } };
  for (const [label, period] of [['30 Days', roadmap.day30], ['60 Days', roadmap.day60], ['90 Days', roadmap.day90]]) {
    doc.font('Helvetica-Bold').fontSize(11).text(label); doc.font('Helvetica').fontSize(10.5);
    bulletList(doc, period.fromAudit, '(no critical items in this window)');
    if (period.standard.length) {
      doc.fillColor(SLATE).text('Standard growth initiatives:', { indent: 10 });
      bulletList(doc, period.standard.map(s => s));
      doc.fillColor(NAVY);
    }
    doc.moveDown(0.4);
  }

  doc.end();
}

module.exports = { streamReportPdf };
