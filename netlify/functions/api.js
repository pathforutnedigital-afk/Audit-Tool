const express = require('express');
const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');

const clientsRouter = require('../../routes/clients');
const auditRouter = require('../../routes/audit');
const googleRouter = require('../../routes/google');
const competitorsRouter = require('../../routes/competitors');
const reportRouter = require('../../routes/report');
const adminRouter = require('../../routes/admin');
const detectRouter = require('../../routes/detect');

const app = express();
app.use(express.json());
app.use('/api/clients', clientsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/google', googleRouter);
app.use('/api/competitors', competitorsRouter);
app.use('/api/report', reportRouter);
app.use('/api/admin', adminRouter);
app.use('/api/detect', detectRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unable to complete this request. Please try again.' });
});

// `binary` tells serverless-http which response content-types to base64-encode and mark
// isBase64Encoded — required for the PDF report route to come through uncorrupted on Netlify.
const slsHandler = serverless(app, { binary: ['application/pdf'] });

module.exports.handler = async (event, context) => {
  // Netlify injects an event.blobs field in production/`netlify dev`; connectLambda needs it
  // to wire up Blobs access. Guard it so a missing context (e.g. a non-Netlify test harness)
  // doesn't crash the whole function — Blobs calls will just fail clearly later instead.
  if (event.blobs) {
    try { connectLambda(event); } catch (_) { /* fall through */ }
  }
  return slsHandler(event, context);
};
