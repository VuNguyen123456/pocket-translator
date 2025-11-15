/**
 * Lambda handler for the /llm endpoint.
 *
 * This function is deployed as an AWS Lambda and exposed via API Gateway (POST /llm).
 * The browser extension sends a JSON body:
 *   { mode: "simplify" | "summarize", text: string, requestId: string }
 *
 * We call Azure OpenAI (deployment: gpt-4.1-mini-2) via azureLlmClient.js to:
 *   - simplifyText(text)   when mode === "simplify"
 *   - summarizeText(text)  when mode === "summarize"
 *
 * The response is normalized to:
 *   { success, requestId, mode, outputText, source }
 *
 * On error, we return:
 *   { success: false, requestId, mode, error: { code, message, details }, fallbackText }
 *
 * `fallbackText` is just the original input text so the frontend still has
 * something to read even if the LLM fails.
 *
 * This is the Azure LLM backend I implemented for PatriotHacks to power the
 * simplify/summarize accessibility feature in our browser extension.
 */

// src/llmHandler.js
// Lambda handler for the /llm endpoint.
// This is the bridge between the browser extension and Azure OpenAI mini.

const { makeError } = require('./utils');
const { simplifyText, summarizeText } = require('./azureLlmClient');

// Optional: cap length here as well for extra safety.
const MAX_TEXT_LENGTH = Number(process.env.LLM_MAX_TEXT_LENGTH || 8000);

const ALLOWED_MODES = new Set(['simplify', 'summarize']);

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
 * Safely parse the JSON body from an API Gateway event.
 */
function parseBody(event) {
  if (!event || typeof event.body !== 'string') {
    return {};
  }
  try {
    return JSON.parse(event.body);
  } catch (err) {
    throw makeError('BAD_REQUEST', 'Request body must be valid JSON.', {
      rawBody: event.body,
    });
  }
}

/**
 * Clamp text length to avoid blowing token limits.
 */
function clampText(text) {
  if (!text) return '';
  const s = text.toString();
  if (s.length <= MAX_TEXT_LENGTH) return s;
  return s.slice(0, MAX_TEXT_LENGTH) + '\n\n[Text truncated for length]';
}

async function handler(event) {
  // Handle CORS preflight
  if (event?.httpMethod === 'OPTIONS') {
    return buildResponse(204, {});
  }

  let requestId;
  let mode;
  let text;

  try {
    const body = parseBody(event);
    requestId = body.requestId || 'server-generated-' + Date.now().toString(36);
    mode = (body.mode || 'simplify').toLowerCase();
    text = clampText(body.text || '');

    if (!ALLOWED_MODES.has(mode)) {
      throw makeError(
        'BAD_REQUEST',
        `Invalid mode "${mode}". Expected "simplify" or "summarize".`,
        { mode }
      );
    }

    if (!text || !text.trim()) {
      throw makeError(
        'BAD_REQUEST',
        'Text is required and cannot be empty.',
        {}
      );
    }

    let outputText;

    if (mode === 'simplify') {
      outputText = await simplifyText(text, { requestId });
    } else if (mode === 'summarize') {
      outputText = await summarizeText(text, { requestId });
    }

    return buildResponse(200, {
      success: true,
      requestId,
      mode,
      outputText,
      source: 'azure-openai-mini',
    });
  } catch (err) {
    console.error('Azure LLM call failed', err);

    const errorPayload = {
      code: err.code || 'LAMBDA_LLM_ERROR',
      message: err.message || 'Failed to call Azure LLM service.',
      details: err.details,
    };

    // We still send back the original (possibly truncated) text as fallbackText
    // so the frontend can choose to read it out even if the LLM failed.
    return buildResponse(502, {
      success: false,
      requestId,
      mode,
      error: errorPayload,
      fallbackText: text,
    });
  }
}

module.exports = {
  handler,
};
