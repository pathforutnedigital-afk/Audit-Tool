const CTA_PHRASES = ['get a quote', 'book now', 'contact us', 'get started', 'request a demo', 'buy now', 'sign up', 'schedule a call', 'free consultation', 'learn more'];

function auditLeadGen($, html) {
  const bodyText = $('body').text().toLowerCase();

  const checks = [
    { label: 'Contact form', ok: $('form').length > 0, weight: 'major' },
    { label: 'Phone number listed', ok: /tel:/i.test(html) || /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(bodyText), weight: 'major' },
    { label: 'Clear call-to-action', ok: CTA_PHRASES.some(p => bodyText.includes(p)) || $('.btn, .button, a[class*="cta"], button').length > 0, weight: 'major' },
    { label: 'WhatsApp contact link', ok: /wa\.me|whatsapp/i.test(html), weight: 'minor' },
    { label: 'Email contact link', ok: /mailto:/i.test(html), weight: 'minor' },
    { label: 'Newsletter signup', ok: /newsletter|subscribe to/i.test(bodyText), weight: 'minor' },
    { label: 'Testimonials', ok: /testimonial/i.test(bodyText), weight: 'minor' },
    { label: 'Case studies', ok: /case stud/i.test(bodyText), weight: 'minor' },
    { label: 'Trust signals (badges/certifications)', ok: /trusted by|as seen in|certified|accredited|award[- ]winning/i.test(bodyText), weight: 'minor' },
  ];

  const passed = checks.filter(c => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);

  const findings = checks.filter(c => !c.ok).map(c => ({
    severity: c.weight,
    area: 'Lead Generation',
    issue: `Missing: ${c.label}`,
  }));

  return {
    score,
    checks: Object.fromEntries(checks.map(c => [c.label, c.ok])),
    findings,
  };
}

module.exports = { auditLeadGen };
