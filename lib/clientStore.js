const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Netlify Functions must ALWAYS use Blobs for persistence — the bundled function's filesystem
 * is not a reliable place to write (this is exactly the ENOENT bug this file exists to fix:
 * esbuild bundles this whole module into netlify/functions/api.js, so __dirname inside a
 * deployed function resolves to /var/task/netlify/functions, and guessing "are we on Netlify?"
 * from ambient env vars like NETLIFY/NETLIFY_DEV proved unreliable in production).
 *
 * Instead of guessing, only server.js (plain local `npm start`) explicitly opts into filesystem
 * storage by setting LOCAL_FS_STORAGE=true before this module is first required. Any other
 * execution path — including every Netlify Function invocation — uses Blobs.
 */
const USE_FS = process.env.LOCAL_FS_STORAGE === 'true';

const DB_PATH = path.join(__dirname, '..', 'data', 'clients.json');

let _clientStore = null;
function clientBlobStore() {
  if (!_clientStore) {
    const { getStore } = require('@netlify/blobs');
    _clientStore = getStore('pathfortune-clients');
  }
  return _clientStore;
}
let _auditStore = null;
function auditBlobStore() {
  if (!_auditStore) {
    const { getStore } = require('@netlify/blobs');
    _auditStore = getStore('pathfortune-audits');
  }
  return _auditStore;
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

// ---------- local filesystem fallback (dev only, single-file array) ----------
function readAllFs() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeAllFs(clients) {
  fs.writeFileSync(DB_PATH, JSON.stringify(clients, null, 2));
}

// ================= Clients =================

async function listClients() {
  if (USE_FS) return readAllFs();
  const store = clientBlobStore();
  const { blobs } = await store.list({ prefix: 'client:' });
  const results = await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })));
  return results.filter(Boolean);
}

async function getClient(id) {
  if (USE_FS) return readAllFs().find(c => c.id === id);
  return clientBlobStore().get(`client:${id}`, { type: 'json' });
}

async function createClient(input) {
  const record = {
    id: newId('client'),
    name: input.name,
    websiteUrl: input.websiteUrl,
    industry: input.industry || 'Unspecified',
    socialLinks: input.socialLinks || [],
    social: input.social || {},
    google: {},               // { refreshToken, searchConsoleSite, ga4PropertyId }
    competitors: [],          // up to 3 competitor URLs
    lastCompetitorReport: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAudit: null,
    auditHistory: [],         // [{ id, date, score }] — capped at the most recent 24 runs
  };
  if (USE_FS) {
    const clients = readAllFs();
    clients.push(record);
    writeAllFs(clients);
    return record;
  }
  await clientBlobStore().setJSON(`client:${record.id}`, record);
  return record;
}

async function updateClient(updated) {
  updated.updatedAt = new Date().toISOString();
  if (USE_FS) {
    const clients = readAllFs();
    const idx = clients.findIndex(c => c.id === updated.id);
    if (idx === -1) throw new Error('Client not found');
    clients[idx] = updated;
    writeAllFs(clients);
    return updated;
  }
  const existing = await getClient(updated.id);
  if (!existing) throw new Error('Client not found');
  await clientBlobStore().setJSON(`client:${updated.id}`, updated);
  return updated;
}

async function deleteClient(id) {
  if (USE_FS) {
    writeAllFs(readAllFs().filter(c => c.id !== id));
    return;
  }
  await clientBlobStore().delete(`client:${id}`);
}

// ================= Audits (first-class, addressable records) =================

async function createAudit(clientId, websiteUrl, results, score) {
  const audit = {
    id: newId('audit'),
    clientId,
    website: websiteUrl,
    createdAt: new Date().toISOString(),
    score: score ?? null,
    results,
  };
  if (!USE_FS) await auditBlobStore().setJSON(`audit:${audit.id}`, audit);
  return audit;
}

async function getAudit(id) {
  if (USE_FS) return null; // fs mode keeps only the embedded client.lastAudit, not a separate record
  return auditBlobStore().get(`audit:${id}`, { type: 'json' });
}

async function listAudits(clientId) {
  if (USE_FS) return [];
  const store = auditBlobStore();
  const { blobs } = await store.list({ prefix: 'audit:' });
  const all = await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })));
  return all.filter(a => a && (!clientId || a.clientId === clientId));
}

/**
 * Persists a first-class Audit record AND updates the client's embedded lastAudit/auditHistory
 * fields — the frontend reads client.lastAudit / client.auditHistory directly, so this keeps
 * that contract unchanged while also giving audits real, independently addressable IDs.
 */
async function saveAuditResult(clientId, result) {
  const client = await getClient(clientId);
  if (!client) throw new Error('Client not found');
  const audit = await createAudit(clientId, client.websiteUrl, result, result.digitalScore?.overall ?? null);
  client.lastAudit = result;
  const history = client.auditHistory || [];
  history.push({ id: audit.id, date: result.generatedAt, score: audit.score });
  client.auditHistory = history.slice(-24);
  await updateClient(client);
  return client;
}

module.exports = {
  // clean external names
  createClient, getClient, listClients, updateClient, deleteClient,
  createAudit, getAudit, listAudits,
  // back-compat aliases so existing route files don't need to change their call sites
  list: listClients, get: getClient, create: createClient, remove: deleteClient,
  saveAuditResult,
};
