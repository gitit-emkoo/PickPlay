// HTTP entry to be used by Cloud Functions/Run or local cron
const express = require('express');
const cors = require('cors');
const { fetchExpoTokens } = require('./tokenRepository');
const { buildDailyMessage } = require('./messageBuilder');
const { sendExpoMessages } = require('./pushService');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Trigger daily broadcast
app.post('/broadcast/daily', async (req, res) => {
  try {
    const { title, body } = req.body || {};
    const tokens = await fetchExpoTokens();
    const msg = buildDailyMessage({ title, body });
    const messages = tokens.map(to => ({ to, ...msg }));
    await sendExpoMessages(messages);
    res.json({ ok: true, sent: messages.length });
  } catch (e) {
    console.error('❌ broadcast error', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// For Cloud Functions v2 export
module.exports = app;

// If run locally: node server/index.js
if (require.main === module) {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`🚀 push server listening on http://localhost:${port}`);
  });
}


