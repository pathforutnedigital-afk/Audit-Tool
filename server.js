require('dotenv').config();

// Only plain local `npm start` uses filesystem storage. Netlify Functions never set this, so
// they always use Blobs — see lib/clientStore.js for why guessing the environment is unsafe.
process.env.LOCAL_FS_STORAGE = 'true';

const express = require('express');
const path = require('path');

const clientsRouter = require('./routes/clients');
const auditRouter = require('./routes/audit');
const googleRouter = require('./routes/google');
const competitorsRouter = require('./routes/competitors');
const reportRouter = require('./routes/report');
const adminRouter = require('./routes/admin');
const detectRouter = require('./routes/detect');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/clients', clientsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/google', googleRouter);
app.use('/api/competitors', competitorsRouter);
app.use('/api/report', reportRouter);
app.use('/api/admin', adminRouter);
app.use('/api/detect', detectRouter);

// Catches every error passed via next(err) — including from asyncHandler-wrapped routes —
// so a thrown error becomes a clean, generic JSON 500 instead of crashing the process or
// leaking internal details (file paths, stack traces) to the client. Full detail is logged
// server-side only. Routes that need a specific 4xx message (e.g. "Client not found") send
// that directly with res.status(...).json(...) and never reach this handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unable to complete this request. Please try again.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Digital Audit Tool running at http://localhost:${PORT}`);
});
