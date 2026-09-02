const fetch = require('node-fetch');

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
// Colors so common (black/white/transparent/currentColor family) they don't tell you anything about brand identity
const NOISE = new Set(['#fff', '#ffffff', '#000', '#000000', 'rgba(0,0,0,0)', 'rgba(0, 0, 0, 0)']);

function normalizeColor(c) {
  return c.replace(/\s+/g, '').toLowerCase();
}

function tallyColors(cssText, tally) {
  const matches = cssText.match(COLOR_RE) || [];
  for (const raw of matches) {
    const c = normalizeColor(raw);
    if (NOISE.has(c)) continue;
    tally.set(c, (tally.get(c) || 0) + 1);
  }
}

async function auditColors($, finalUrl) {
  const tally = new Map();

  // Inline <style> blocks
  $('style').each((_, el) => tallyColors($(el).html() || '', tally));
  // Inline style="" attributes
  $('[style]').each((_, el) => tallyColors($(el).attr('style') || '', tally));

  // First few linked stylesheets (real brand colors usually live here, not inline)
  const origin = new URL(finalUrl).origin;
  const hrefs = $('link[rel="stylesheet"]')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter(Boolean)
    .slice(0, 5)
    .map(href => {
      try { return new URL(href, finalUrl).href; } catch { return null; }
    })
    .filter(Boolean);

  await Promise.all(hrefs.map(async href => {
    try {
      const res = await fetch(href, { headers: { 'User-Agent': 'DigitalAuditTool/1.0' } });
      if (res.ok) tallyColors(await res.text(), tally);
    } catch (_) { /* skip unreachable stylesheet */ }
  }));

  const palette = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([color, count]) => ({ color, count }));

  const findings = [];
  if (palette.length === 0) {
    findings.push({ severity: 'minor', area: 'Visual', issue: 'Could not detect a distinct color palette — colors may be defined via CSS variables or a bundled/minified stylesheet this scan could not parse' });
  } else if (palette.length > 6) {
    findings.push({ severity: 'minor', area: 'Visual', issue: `${palette.length}+ distinct accent colors detected — a tight brand palette (2–4 colors) usually reads as more intentional and trustworthy` });
  }

  return {
    palette,
    stylesheetsScanned: hrefs.length,
    findings,
  };
}

module.exports = { auditColors };
