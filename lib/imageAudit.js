const fetch = require('node-fetch');

function guessFormat(url) {
  const m = url.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  return m ? m[1].toLowerCase() : 'unknown';
}

async function auditImages($, finalUrl) {
  const raw = $('img').map((_, el) => ({
    src: $(el).attr('src') || $(el).attr('data-src') || '',
    alt: ($(el).attr('alt') || '').trim(),
  })).get().filter(i => i.src);

  const resolved = raw.map(i => {
    let abs = null;
    try { abs = new URL(i.src, finalUrl).href; } catch { /* skip malformed */ }
    return { ...i, url: abs, format: abs ? guessFormat(abs) : 'unknown' };
  }).filter(i => i.url);

  // Only HEAD-check a sample — checking every image on a large page would be slow and noisy
  const sample = resolved.slice(0, 20);
  await Promise.all(sample.map(async img => {
    try {
      const res = await fetch(img.url, { method: 'HEAD', headers: { 'User-Agent': 'DigitalAuditTool/1.0' } });
      img.sizeBytes = res.ok ? Number(res.headers.get('content-length')) || null : null;
      img.contentType = res.headers.get('content-type') || null;
    } catch (_) {
      img.sizeBytes = null;
      img.contentType = null;
    }
  }));

  const withAlt = resolved.filter(i => i.alt).length;
  const heavyImages = sample.filter(i => i.sizeBytes && i.sizeBytes > 300_000);
  const modernFormats = resolved.filter(i => ['webp', 'avif'].includes(i.format)).length;
  const legacyFormats = resolved.filter(i => ['jpg', 'jpeg', 'png'].includes(i.format)).length;

  const findings = [];
  if (resolved.length && withAlt / resolved.length < 0.8) {
    findings.push({ severity: 'major', area: 'Images', issue: `${resolved.length - withAlt} of ${resolved.length} images missing descriptive alt text` });
  }
  if (heavyImages.length) {
    findings.push({ severity: 'major', area: 'Images', issue: `${heavyImages.length} sampled image(s) over 300KB — likely dragging down page speed` });
  }
  if (legacyFormats > 0 && modernFormats === 0) {
    findings.push({ severity: 'minor', area: 'Images', issue: 'No WebP/AVIF images detected — converting from JPG/PNG typically cuts image weight 25–50%' });
  }

  return {
    totalImages: resolved.length,
    imagesWithAlt: withAlt,
    sampledForSize: sample.length,
    heavyImageCount: heavyImages.length,
    modernFormatCount: modernFormats,
    legacyFormatCount: legacyFormats,
    images: sample.map(i => ({ url: i.url, alt: i.alt || null, format: i.format, sizeBytes: i.sizeBytes })),
    findings,
  };
}

module.exports = { auditImages };
