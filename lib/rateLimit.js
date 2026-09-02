const fs = require('fs');
const path = require('path');

// Same reasoning as lib/clientStore.js: don't guess the environment from ambient Netlify env
// vars (that was the root cause of a production ENOENT bug). Only local `npm start` opts in.
const USE_FS = process.env.LOCAL_FS_STORAGE === 'true';
const RL_PATH = path.join(__dirname, '..', 'data', 'ratelimits.json');

let _store = null;
function blobStore() {
  if (!_store) {
    const { getStore } = require('@netlify/blobs');
    _store = getStore('pathfortune-ratelimits');
  }
  return _store;
}

/**
 * Fixed-window rate limit. Returns true if the call is allowed (and counts it), false if the
 * caller is over the limit for this window. `key` should already include the identity of the
 * caller (e.g. their IP) — this function only handles the counting.
 */
async function checkAndIncrement(key, limit, windowMs) {
  const bucket = `${key}:${Math.floor(Date.now() / windowMs)}`;
  let count;
  if (USE_FS) {
    let all = {};
    if (fs.existsSync(RL_PATH)) all = JSON.parse(fs.readFileSync(RL_PATH, 'utf8'));
    count = (all[bucket] || 0) + 1;
    all[bucket] = count;
    fs.writeFileSync(RL_PATH, JSON.stringify(all));
  } else {
    const existing = await blobStore().get(bucket, { type: 'json' }).catch(() => null);
    count = (existing || 0) + 1;
    await blobStore().setJSON(bucket, count);
  }
  return count <= limit;
}

module.exports = { checkAndIncrement };
