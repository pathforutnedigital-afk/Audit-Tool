const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/asyncHandler');
const store = require('../lib/clientStore');

router.get('/', asyncHandler(async (req, res) => {
  res.json(await store.list());
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, websiteUrl, socialLinks, social, industry } = req.body;
  if (!name || !websiteUrl) return res.status(400).json({ error: 'name and websiteUrl are required' });
  const client = await store.create({
    name,
    websiteUrl,
    industry,
    socialLinks: Array.isArray(socialLinks) ? socialLinks.filter(Boolean) : [],
    social: social || {},
  });
  res.status(201).json(client);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const client = await store.get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  res.json(client);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await store.remove(req.params.id);
  res.status(204).end();
}));

module.exports = router;
