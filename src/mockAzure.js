// src/mockAzure.js
// A tiny Express app that simulates the Azure Function TTS endpoint.
// Great for local Lambda testing without hitting Azure quota.
// Run: node src/mockAzure.js
const express = require('express');
const bodyParser = require('body-parser');
const { sign } = require('./utils');

const PORT = process.env.MOCK_AZURE_PORT || 4000;
const SHARED_SECRET = process.env.AZURE_SHARED_SECRET || 'dev-secret';

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

app.post('/api/tts', (req, res) => {
  const ts = req.header('X-Azure-Ts') || '';
  const sig = req.header('X-Azure-Sig') || '';
  // In production Azure should verify the signature; the mock just trusts it.
  // Return a tiny 1-second silent MP3 base64 (or you can supply your own)
  const sampleBase64 = "SUQzAwAAAAAA..."; // placeholder, but we'll return a tiny beep (below)
  const response = {
    success: true,
    requestId: req.body?.requestId || 'mock-1',
    audioBase64: SAMPLE_BASE64(),
    audioContentType: req.body.format || 'audio/mpeg',
    language: req.body?.language || 'en-US',
    voice: req.body?.voice || 'mock-voice',
    outputFormat: req.body?.format || 'audio-16khz-32kbitrate-mono-mp3',
    latencyMs: 42
  };
  res.json(response);
});

function SAMPLE_BASE64() {
  // A short silent mp3 base64 (or small beep). If you have a small mp3 base64, paste it here.
  // For quick dev you can use a tiny base64 string; the browser might not play it but can be saved.
  // We'll use an extremely short valid mp3 header base64 for demo (may not be audible).
  return "SUQzAwAAAAAAAwAAAAEAAABkAAACAAACAA==";
}

app.listen(PORT, () => {
  console.log(`Mock Azure TTS listening ${PORT}/api/tts`);
  console.log(`Set AZURE_FUNCTION_URL=http://localhost:${PORT}/api/tts in your AWS env for testing`);
});
