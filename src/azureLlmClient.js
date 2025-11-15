// src/azureLlmClient.js
// Azure OpenAI "mini" client for simplify/summarize features.
// This is intended to be YOUR module: you own the prompts, options, and error handling.

// Lazy-load node-fetch so this works in Lambda + local dev (CommonJS).
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const { makeError } = require('./utils');

// These env vars are injected in Lambda so no secrets live in code.
const AZURE_OPENAI_ENDPOINT   = process.env.AZURE_OPENAI_ENDPOINT;   // e.g. "https://my-resource.openai.azure.com"
const AZURE_OPENAI_API_KEY    = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT; // e.g. "gpt-4o-mini" or your deployment name
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

// Safety: limit how much text we send in one go (characters, not tokens).
const LLM_MAX_INPUT_CHARS = Number(process.env.LLM_MAX_INPUT_CHARS || 8000);

/**
 * Internal helper to call Azure OpenAI chat completions.
 * You can tweak model options here (temperature, max_tokens, etc.).
 */
async function callAzureChat(messages, options = {}) {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !AZURE_OPENAI_DEPLOYMENT) {
    throw makeError(
      'CONFIG_ERROR',
      'Azure OpenAI environment variables are not fully configured.',
      {
        endpoint: !!AZURE_OPENAI_ENDPOINT,
        apiKey: !!AZURE_OPENAI_API_KEY,
        deployment: !!AZURE_OPENAI_DEPLOYMENT,
      }
    );
  }

  const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  const body = {
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 512,
    top_p: options.topP ?? 0.9,
    n: 1,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': AZURE_OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      `Azure OpenAI returned HTTP ${res.status}`;
    throw makeError('AZURE_LLM_ERROR', msg, {
      status: res.status,
      body: json,
    });
  }

  const choice = json?.choices?.[0];
  const text = choice?.message?.content;
  if (!text) {
    throw makeError('AZURE_LLM_ERROR', 'Azure OpenAI response missing content.', {
      body: json,
    });
  }

  return text.trim();
}

/**
 * Clamp text to a maximum length so we don't blow past token limits.
 * Simple but good enough for hackathon scale.
 */
function clampText(text) {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= LLM_MAX_INPUT_CHARS) return trimmed;
  return trimmed.slice(0, LLM_MAX_INPUT_CHARS) + '\n\n[Text truncated for length]';
}

/**
 * Simplify text for accessibility:
 * - Aim for ~high school reading level
 * - Short sentences, clear vocabulary
 * - Preserve core meaning
 */
async function simplifyText(text, { requestId } = {}) {
  const input = clampText(text);

  const systemPrompt = [
    'You are an accessibility assistant.',
    'Simplify the user\'s text so it is easy to understand for a high-school reader.',
    'Use short, clear sentences and plain vocabulary.',
    'Preserve the original meaning and key details.',
    'Avoid adding new opinions or facts that are not in the text.',
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Simplify the following text:\n\n${input}`,
    },
  ];

  const content = await callAzureChat(messages, {
    temperature: 0.25,
    maxTokens: 800,
  });

  return content;
}

/**
 * Summarize text into concise bullet points:
 * - 3–7 bullets
 * - Focus on key ideas
 * - Easy-to-read wording
 */
async function summarizeText(text, { requestId } = {}) {
  const input = clampText(text);

  const systemPrompt = [
    'You are an accessibility assistant.',
    'Summarize the user\'s text into a short list of bullet points.',
    'Use simple language and focus on the most important ideas.',
    'Do not include more than 7 bullets.',
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Summarize the following text into bullet points:\n\n${input}`,
    },
  ];

  const content = await callAzureChat(messages, {
    temperature: 0.3,
    maxTokens: 600,
  });

  return content;
}

module.exports = {
  simplifyText,
  summarizeText,
};
