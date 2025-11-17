// Powered by Chatgpt + PatriotRead team
// src/utils.js
const crypto = require('crypto');

// Small helper utilities shared by handler + mock server.

function makeError(code, message, details = null) {
  const error = { code, message };
  if (details) {
    error.details = details;
  }
  return { success: false, error };
}

function sign(secret, ts, body) {
  const h = crypto.createHmac('sha256', secret);
  h.update(ts + '\n' + body);
  return h.digest('hex');
}

function isValidLanguage(lang) {
  return typeof lang === 'string' && lang.length >= 2 && lang.length <= 10;
}

module.exports = { makeError, sign, isValidLanguage };
