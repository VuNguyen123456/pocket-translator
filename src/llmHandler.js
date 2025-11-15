// src/llmHandler.js
// Lambda handler for the /llm endpoint.
// This is the bridge between the browser extension and Azure OpenAI mini.

const { makeError } = require('./utils');
const { simplifyText, summarizeText } = require('./azureLlmClient');

// Optional: cap length here as well for extra safety.
const MAX_TEXT_LENGTH = Number(process.env.LLM_MAX_TEXT_LENGTH || 8000);

/**
 * Helper to standardize responses with CORS headers so the browser extension
 * can call this Lambda through API Gateway.
 */
function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Generate a simple request ID if the client didn't send one.
 */
function makeRequestId(prefix = 'llm') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, makeError('METHOD_NOT_ALLOWED', 'Only POST is allowed.'));
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return buildResponse(400, makeError('BAD_JSON', 'Request body must be valid JSON.'));
  }

  const {
    mode,        // "simplify" | "summarize"
    text,
    requestId,
  } = body || {};

  const effectiveRequestId = requestId || makeRequestId();

  if (typeof text !== 'string' || !text.trim()) {
    return buildResponse(
      400,
      makeError('MISSING_TEXT', 'Request body must include non-empty "text" string.')
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return buildResponse(
      400,
      makeError('TEXT_TOO_LONG', `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`, {
        maxLength: MAX_TEXT_LENGTH,
        length: text.length,
      })
    );
  }

  if (mode !== 'simplify' && mode !== 'summarize') {
    return buildResponse(
      400,
      makeError('BAD_MODE', 'Mode must be "simplify" or "summarize".')
    );
  }

  try {
    let outputText;
    if (mode === 'simplify') {
      outputText = await simplifyText(text, { requestId: effectiveRequestId });
    } else {
      outputText = await summarizeText(text, { requestId: effectiveRequestId });
    }

    return buildResponse(200, {
      success: true,
      requestId: effectiveRequestId,
      mode,
      outputText,
      source: 'azure-openai-mini',
    });
  } catch (err) {
    console.error('Azure LLM call failed', err);

    // If azureLlmClient threw a makeError object, reuse it; otherwise wrap.
    if (err && err.error && err.success === false) {
      return buildResponse(502, err); // already in { success:false, error:{...} } shape
    }

    return buildResponse(
      502,
      makeError('LAMBDA_LLM_ERROR', 'Failed to call Azure LLM service.', {
        message: String(err && err.message || err),
      })
    );
  }
};
