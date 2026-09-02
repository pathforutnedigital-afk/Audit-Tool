const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/asyncHandler');
const store = require('../lib/clientStore');
const { streamReportPdf } = require('../lib/pdfReport');

router.get('/:clientId/pdf', asyncHandler(async (req, res) => {
  const client = await store.get(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (!client.lastAudit) return res.status(400).json({ error: 'Run an audit before downloading a report' });
  streamReportPdf(client, res);
}));

module.exports = router;
