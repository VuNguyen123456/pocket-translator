//Powered by Chatgpt + PatriotRead team
// src/handler.js
const { isValidLanguage, makeError } = require('./utils');
const { callAzure } = require('./azureClient');

// These env vars are injected in Lambda (or locally) so no secrets live in code.
const AZURE_URL = process.env.AZURE_FUNCTION_URL;
const AZURE_SECRET = process.env.AZURE_SHARED_SECRET;
const MAX_TEXT_LENGTH = Number(process.env.MAX_TEXT_LENGTH || 5000);
const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || 'en-US';

/**
 * Helper to standardize responses with CORS headers so the browser extension
 * can call this Lambda through API Gateway without any extra config.
 */
function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
}

/**
 * Lambda entry point. Receives the API Gateway event, validates the body,
 * forwards a cleaned contract to Azure, and sends the normalized response
 * (audioBase64 + metadata) back to the browser extension.
 */
exports.handler = async function(event) {
  // 1) Browser extensions must issue CORS preflight requests. Respond early.
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(204, {});
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return buildResponse(400, makeError('BAD_REQUEST', 'Invalid JSON body.'));
  }

  const {
    requestId,
    text,
    language,
    voice,
    format,
    translateTo,
    targetLanguage,
    simplify
  } = payload;
  // At this point payload is trusted JSON, but fields still need validation.

  // Basic validation — keep logic lightweight so the free-tier Lambda stays fast.
  if (!text || typeof text !== 'string') {
    return buildResponse(400, makeError('BAD_REQUEST', 'Field "text" is required and must be a string.'));
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return buildResponse(413, makeError('TEXT_TOO_LONG', `Max ${MAX_TEXT_LENGTH} chars`));
  }
  // Default the language/format if user did not supply anything.
  const lang = language && isValidLanguage(language) ? language : DEFAULT_LANGUAGE;
  const outFormat = (format === 'audio/wav') ? 'audio/wav' : 'audio/mp3';

  /**
   * Payload that AWS sends to Azure.
   */
  const azurePayload = {
    requestId: requestId || (Math.random().toString(36).slice(2)),
    text,
    language: lang,
    voice: voice || 'default',
    format: outFormat,
    translateTo: (typeof targetLanguage !== 'undefined' ? targetLanguage : translateTo) || null,
    simplify: !!simplify,
    caller: 'aws'
  };

  try {
    // callAzure wraps fetch + our shared-secret signature so Azure knows
    // this came from AWS and not an attacker.
    const resp = await callAzure(AZURE_URL, AZURE_SECRET, azurePayload);
    const azureBody = resp.bodyJson || {};
    const azureSuccess = azureBody.success ?? (azureBody.status === 'ok');
    if (resp.statusCode === 200 && azureSuccess) {
      const audioBase64 = azureBody.audioBase64 || azureBody.audio?.base64;
      const audioContentType = azureBody.audioContentType || azureBody.audio?.mime || 'audio/mpeg';
      if (!audioBase64) {
        return buildResponse(502, makeError('AZURE_TTS_ERROR', 'Azure response missing audio payload.'));
      }
      // Success: return the minimal fields the extension needs to play audio.
      return buildResponse(200, {
        success: true,
        requestId: azureBody.requestId || azurePayload.requestId,
        audioBase64,
        audioContentType,
        language: azureBody.language || lang,
        voice: azureBody.voice || azureBody.meta?.voice || azurePayload.voice,
        source: 'azure-tts',
        latencyMs: azureBody.latencyMs ?? azureBody.meta?.latencyMs ?? null
      });
    } else if (resp.statusCode === 429) {
      const retryAfter = resp.bodyJson?.retryAfterS ?? 5;
      return buildResponse(429, makeError('AZURE_RATE_LIMIT', 'Azure rate limited request.', { retryAfterS: retryAfter }));
    } else {
      // Azure returned an error (4xx/5xx). Bubble up their code/message when present.
      const code =
        azureBody.error?.code ||
        resp.bodyJson?.code ||
        (resp.statusCode >= 500 ? 'AZURE_TTS_ERROR' : 'BAD_REQUEST');
      const msg =
        azureBody.error?.message ||
        resp.bodyJson?.message ||
        azureBody.message ||
        `Azure returned ${resp.statusCode}`;
      return buildResponse(502, makeError(code, msg, { azureStatus: resp.statusCode }));
    }
  } catch (err) {
    console.error('Azure call failed', err);
    return buildResponse(502, makeError('LAMBDA_ERROR', 'Failed to call Azure service.', { err: String(err) }));
  }
};
