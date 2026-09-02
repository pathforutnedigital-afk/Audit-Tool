const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/asyncHandler');
const { fetchPage } = require('../lib/fetchPage');

const PLATFORM_PATTERNS = {
  instagram: /instagram\.com/i,
  facebook: /facebook\.com/i,
  linkedin: /linkedin\.com/i,
  youtube: /youtube\.com/i,
  x: /(?:^|\/\/)(?:www\.)?(?:x|twitter)\.com/i,
  pinterest: /pinterest\.com/i,
  tiktok: /tiktok\.com/i,
  googleBusiness: /(?:g\.page|maps\.google\.|business\.google\.)/i,
};

router.post('/social', asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  let page;
  try {
    page = await fetchPage(url);
  } catch (e) {
    return res.status(502).json({ error: `Could not reach ${url}: ${e.message}` });
  }

  const links = page.$('a[href]').map((_, el) => page.$(el).attr('href')).get();
  const detected = {};
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    const match = links.find(href => pattern.test(href) && !href.includes('/sharer') && !href.includes('/intent/'));
    if (match) {
      try { detected[platform] = new URL(match, page.finalUrl).href; }
      catch { /* skip malformed href */ }
    }
  }

  res.json({ detected });
}));

module.exports = router;
