const cheerio = require('cheerio');
const fetch = require('node-fetch');
const { assertSafeUrl } = require('./urlSafety');

async function fetchPage(url) {
  await assertSafeUrl(url);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DigitalAuditTool/1.0 (+agency audit bot)' },
    redirect: 'follow',
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const finalUrl = res.url || url;
  return { html, $, res, finalUrl };
}

module.exports = { fetchPage };
