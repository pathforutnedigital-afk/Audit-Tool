const dns = require('dns').promises;
const net = require('net');

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local / cloud metadata (169.254.169.254)
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1') return true;
    if (l.startsWith('fe80:')) return true;
    if (l.startsWith('fc') || l.startsWith('fd')) return true;
    return false;
  }
  return true; // unrecognized format — fail closed
}

/**
 * Validates a user-supplied URL is safe to fetch server-side: http(s) only, and the hostname
 * must not resolve to a private/loopback/link-local address (blocks SSRF into internal
 * infrastructure, including cloud metadata endpoints like 169.254.169.254).
 * Throws with a clear message if the URL is rejected; otherwise returns the parsed URL.
 */
async function assertSafeUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http/https URLs are allowed');
  const hostname = u.hostname.toLowerCase();
  if (['localhost', '0.0.0.0', '[::1]'].includes(hostname)) throw new Error('That URL is not allowed');

  let addresses;
  try { addresses = await dns.lookup(hostname, { all: true }); }
  catch { throw new Error(`Could not resolve hostname: ${hostname}`); }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) throw new Error('That URL resolves to a private/internal address and is not allowed');
  }
  return u;
}

module.exports = { assertSafeUrl };
