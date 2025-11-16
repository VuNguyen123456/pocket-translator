// Powered by Chatgpt
// src/azureLlmClient.js
// Azure OpenAI "mini" client for simplify/summarize features.

// Lazy-load node-fetch so this works in Lambda + local dev (CommonJS).
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const { makeError } = require('./utils');

// These env vars are injected in Lambda so no secrets live in code.
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;   // e.g. "https://my-resource.openai.azure.com"
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT; 
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

// Safety: limit how much text we send in one go (characters, not tokens).
const LLM_MAX_INPUT_CHARS = Number(process.env.LLM_MAX_INPUT_CHARS || 8000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text, maxChars = 4000) {
  const chunks = [];
  let current = "";

  const paragraphs = text.split(/\n\s*\n/); // split on blank lines

  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxChars) {
      if (current) chunks.push(current);
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function callAzureLLMChunked({ text, mode, lang }) {
  const chunks = chunkText(text);

  // For simple/summarize/accessibility:
  if (chunks.length === 1) {
    return callAzureLLM({ text, mode, lang });
  }

  // 1) Summarize/simplify each chunk
  const partials = [];
  for (const c of chunks) {
    const res = await callAzureLLM({ text: c, mode, lang });
    partials.push(res.raw); // or res.json.simple_text, etc.
  }

  // 2) Combine those into a final summary / rewrite
  const combinedText = partials.join("\n\n");

  return callAzureLLM({
    text: combinedText,
    mode,
    lang
  });
}
/**
 * Internal helper to call Azure OpenAI chat completions.
 */
async function callAzureChat(
  messages,
  {
    temperature = 0.2,
    maxTokens = 800,
    requestId = null,
    mode = null,
    textLength = null,
    chunkCount = null,
  } = {}
) {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !AZURE_OPENAI_DEPLOYMENT) {
    throw makeError(
      'AzureOpenAIConfigError',
      'Azure OpenAI environment variables are not configured.'
    );
  }

  const url =
    `${AZURE_OPENAI_ENDPOINT}` +
    `/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}` +
    `/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  const body = {
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000; // 2 seconds

  let attempt = 0;
  let lastErr = null;

  while (attempt < MAX_RETRIES) {
    const started = Date.now();
    attempt += 1;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'azure_llm_response_parse_error',
            requestId,
            mode,
            status: res.status,
            body: text.slice(0, 500),
          })
        );
        throw makeError('AzureOpenAIParseError', 'Failed to parse Azure OpenAI response as JSON.');
      }

      const latencyMs = Date.now() - started;

      // Structured log
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'azure_llm_call',
          requestId,
          mode,
          text_length: textLength,
          chunk_count: chunkCount,
          latency_ms: latencyMs,
          status: res.status,
          attempt,
        })
      );

      const azureError = data && data.error ? data.error : null;
      const rateLimited =
        res.status === 429 ||
        azureError?.code === 'RateLimitReached' ||
        azureError?.code === 'TooManyRequests';

      // If rate-limited and we still have retries left → backoff + retry
      if (rateLimited && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        console.warn(
          JSON.stringify({
            level: 'warn',
            event: 'azure_llm_rate_limited',
            requestId,
            mode,
            status: res.status,
            azureError,
            attempt,
            retry_in_ms: delay,
          })
        );
        await sleep(delay);
        continue; // retry loop
      }

      // If not ok and not retryable, throw
      if (!res.ok) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'azure_llm_http_error',
            requestId,
            mode,
            status: res.status,
            error: azureError,
          })
        );
        throw makeError(
          'AzureOpenAIHttpError',
          `Azure OpenAI returned HTTP ${res.status}`,
          { azureError }
        );
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw makeError('AzureOpenAIContentError', 'No content in Azure OpenAI response.');
      }

      return content.trim();
    } catch (err) {
      lastErr = err;
      const latencyMs = Date.now() - started;

      console.error(
        JSON.stringify({
          level: 'error',
          event: 'azure_llm_network_error',
          requestId,
          mode,
          text_length: textLength,
          chunk_count: chunkCount,
          latency_ms: latencyMs,
          attempt,
          message: err && err.message ? err.message : String(err),
        })
      );
      // Here we only retry on 429 above; for other errors we break.
      break;
    }
  }

  // If we got here, retries failed
  throw lastErr || makeError('AzureOpenAIError', 'Azure OpenAI call failed after retries.');
}




/**
 * Clamp text to a maximum length so we don't blow past token limits.
 */
function clampText(text) {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= LLM_MAX_INPUT_CHARS) return trimmed;
  return trimmed.slice(0, LLM_MAX_INPUT_CHARS) + '\n\n[Text truncated for length]';
}

/**
 * Simplify text for accessibility.
 * Not yet used.
 */
async function simplifyText(text, { requestId } = {}) {
  const input = clampText(text);
  const chunks = chunkText(input, 4000);

  // accessibility-optimized system prompt
  const systemPrompt = [
    'You are an accessibility assistant.',
    'Rewrite the user\'s text so it is easy to understand for a high-school reader.',
    'Use short, clear sentences and plain vocabulary.',
    'Preserve the original meaning and important details.',
    'Avoid adding new opinions or facts that are not in the text.'
  ].join(' ');

  const mode = 'simplify';

  // Single-chunk path (short pages)
  if (chunks.length === 1) {
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Simplify the following text:\n\n${input}`,
      },
    ];

    const content = await callAzureChat(messages, {
      temperature: 0.25,
      maxTokens: 400,
      requestId,
      mode,
      textLength: input.length,
      chunkCount: 1,
    });

    return content;
  }

  // Multi-chunk path (long pages)
  const simplifiedChunks = [];

  for (const c of chunks) {
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Simplify the following text:\n\n${c}`,
      },
    ];

    const part = await callAzureChat(messages, {
      temperature: 0.25,
      maxTokens: 400,
      requestId,
      mode,
      textLength: c.length,
      chunkCount: chunks.length,
    });

    simplifiedChunks.push(part);
  }

  return simplifiedChunks.join('\n\n');
}



/**
 * Summarize text into concise bullet points:
 * - 3–7 bullets
 * - Focus on key ideas
 * - Easy-to-read wording
 */
async function summarizeText(text, { requestId } = {}) {
  const input = clampText(text);
  const chunks = chunkText(input, 4000);

  // 🔹 UPDATED: accessibility-aware summarization prompt
  const systemPrompt = [
    'You are an accessibility assistant.',
    'Summarize the user\'s text into a short list of bullet points.',
    'Use simple, clear language and focus on the most important ideas.',
    'Try to give 3–7 bullets total.',
    'Avoid adding new information that is not in the text.'
  ].join(' ');

  const mode = 'summarize';

  // Single-chunk path
  if (chunks.length === 1) {
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Summarize the following text into bullet points:\n\n${input}`,
      },
    ];

    const content = await callAzureChat(messages, {
      temperature: 0.3,
      maxTokens: 300,
      requestId,
      mode,
      textLength: input.length,
      chunkCount: 1,
    });

    return content;
  }

  // Multi-chunk path
  const perChunkBullets = [];

  for (const c of chunks) {
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Summarize the following section into bullet points:\n\n${c}`,
      },
    ];

    const bullets = await callAzureChat(messages, {
      temperature: 0.3,
      maxTokens: 300,
      requestId,
      mode,
      textLength: c.length,
      chunkCount: chunks.length,
    });

    perChunkBullets.push(bullets);
  }

  // Combine all bullets into a final concise list
  const combinedBullets = perChunkBullets.join('\n');

  const finalMessages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Here are bullet-point summaries from different sections of a long text:\n\n${combinedBullets}\n\nPlease combine these into a single list of 3–7 bullets, removing duplicates and keeping only the most important information.`,
    },
  ];

  const finalSummary = await callAzureChat(finalMessages, {
    temperature: 0.3,
    maxTokens: 300,
    requestId,
    mode,
    textLength: input.length,
    chunkCount: chunks.length,
  });

  return finalSummary;
}


module.exports = {
  simplifyText,
  summarizeText,
};
