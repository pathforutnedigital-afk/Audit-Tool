const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/asyncHandler');
const store = require('../lib/clientStore');
const oauth = require('../lib/google/oauth');
const searchConsole = require('../lib/google/searchConsole');
const analytics = require('../lib/google/analytics');

// Kick off OAuth for a given client — frontend redirects the browser to the returned URL
router.get('/connect/:clientId', asyncHandler(async (req, res) => {
  const url = oauth.buildAuthUrl(req.params.clientId); // clientId round-trips as `state`
  res.json({ url });
}));

// Google redirects here after the user grants consent
router.get('/callback', asyncHandler(async (req, res) => {
  const { code, state: clientId, error } = req.query;
  if (error) return res.status(400).send(`Google declined: ${error}`);
  const tokens = await oauth.exchangeCode(code);
  const client = await store.get(clientId);
  if (!client) return res.status(404).send('Client not found');
  client.google = { ...(client.google || {}), refreshToken: tokens.refresh_token || client.google?.refreshToken };
  await store.updateClient(client);
  res.redirect(`/?connected=${clientId}`);
}));

// Once connected, list the sites/properties the granted account can see, so the user can pick
router.get('/options/:clientId', asyncHandler(async (req, res) => {
  const client = await store.get(req.params.clientId);
  if (!client?.google?.refreshToken) return res.status(400).json({ error: 'Not connected to Google yet' });
  const { access_token } = await oauth.refreshAccessToken(client.google.refreshToken);
  const [sites, properties] = await Promise.all([
    searchConsole.listSites(access_token).catch(() => []),
    analytics.listProperties(access_token).catch(() => []),
  ]);
  res.json({ sites, properties });
}));

// Save which Search Console property + GA4 property belong to this client
router.post('/select/:clientId', asyncHandler(async (req, res) => {
  const client = await store.get(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Not found' });
  const { searchConsoleSite, ga4PropertyId } = req.body;
  client.google = { ...(client.google || {}), searchConsoleSite, ga4PropertyId };
  await store.updateClient(client);
  res.json(client);
}));

module.exports = router;
