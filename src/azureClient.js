// src/azureClient.js
// Lazy-load node-fetch so the same file works in Lambda (CommonJS) and locally.
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const { sign } = require('./utils');

const SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
const TRANSLATOR_KEY = process.env.AZURE_TRANSLATOR_KEY;
const TRANSLATOR_REGION = process.env.AZURE_TRANSLATOR_REGION;

const VOICE_FALLBACK = 'en-US-JennyNeural';
const VOICE_MAP = {
  'en-US': 'en-US-JennyNeural',
  'es-ES': 'es-ES-ElviraNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'ar-SA': 'ar-SA-ZariyahNeural'
};

const AUDIO_FORMATS = {
  'audio/wav': {
    outputFormat: 'riff-16khz-16bit-mono-pcm',
    mime: 'audio/wav'
  },
  'audio/mp3': {
    outputFormat: 'audio-16khz-32kbitrate-mono-mp3',
    mime: 'audio/mpeg'
  }
};

async function callAzure(azureUrl, sharedSecret, payloadJson) {
  if (azureUrl) {
    return callAzureFunction(azureUrl, sharedSecret, payloadJson);
  }
  return callCognitiveServices(payloadJson);
}

async function callAzureFunction(azureUrl, sharedSecret, payloadJson) {
  const body = JSON.stringify(payloadJson);
  const ts = new Date().toISOString();
  const signature = sign(sharedSecret, ts, body);

  const res = await fetch(azureUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Azure-Ts': ts,
      'X-Azure-Sig': signature
    },
    body
  });

  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { parsed = null; }

  return { statusCode: res.status, bodyText: text, bodyJson: parsed };
}

async function callCognitiveServices(payload) {
  if (!SPEECH_KEY || !SPEECH_REGION) {
    return {
      statusCode: 500,
      bodyJson: {
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION env vars.'
        }
      }
    };
  }

  const started = Date.now();
  const translateTarget = payload.translateTo || payload.targetLanguage || null;

  try {
    const translation = await maybeTranslate(payload.text, payload.language, translateTarget);
    const speech = await synthesizeSpeech({
      text: translation.text,
      language: translation.language,
      voice: payload.voice,
      format: payload.format
    });

    return {
      statusCode: 200,
      bodyJson: {
        success: true,
        requestId: payload.requestId,
        audioBase64: speech.base64Audio,
        audioContentType: speech.mime,
        language: translation.language,
        voice: speech.voice,
        source: 'azure-tts',
        latencyMs: Date.now() - started
      }
    };
  } catch (err) {
    const code = err.code || 'AZURE_TTS_ERROR';
    return {
      statusCode: err.statusCode || 500,
      bodyJson: {
        success: false,
        error: {
          code,
          message: err.message || 'Azure call failed.'
        }
      }
    };
  }
}

async function maybeTranslate(text, language, targetLanguage) {
  if (!targetLanguage || targetLanguage === '' || targetLanguage === 'none') {
    return { text, language };
  }
  if (!TRANSLATOR_KEY || !TRANSLATOR_REGION) {
    const err = new Error('Translation requested but AZURE_TRANSLATOR_* env vars are missing.');
    err.code = 'CONFIG_ERROR';
    throw err;
  }
  const endpoint = new URL('https://api.cognitive.microsofttranslator.com/translate');
  endpoint.searchParams.set('api-version', '3.0');
  endpoint.searchParams.set('to', targetLanguage);
  if (language) {
    endpoint.searchParams.set('from', language);
  }

  const res = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': TRANSLATOR_KEY,
      'Ocp-Apim-Subscription-Region': TRANSLATOR_REGION
    },
    body: JSON.stringify([{ Text: text }])
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body)) {
    const err = new Error('Azure Translator call failed.');
    err.code = 'AZURE_TRANSLATOR_ERROR';
    err.statusCode = res.status;
    throw err;
  }

  const translation = body[0]?.translations?.[0];
  if (!translation?.text) {
    const err = new Error('Azure Translator response missing translated text.');
    err.code = 'AZURE_TRANSLATOR_ERROR';
    throw err;
  }
  return { text: translation.text, language: translation.to };
}

async function synthesizeSpeech({ text, language, voice, format }) {
  const resolvedVoice = resolveVoice(language, voice);
  const fmt = AUDIO_FORMATS[format] || AUDIO_FORMATS['audio/mp3'];

  const ssml = `
<speak version="1.0" xml:lang="${language}">
  <voice name="${resolvedVoice}">${escapeXml(text)}</voice>
</speak>`;

  const endpoint = `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': fmt.outputFormat,
      'Ocp-Apim-Subscription-Key': SPEECH_KEY,
      'Ocp-Apim-Subscription-Region': SPEECH_REGION
    },
    body: ssml
  });

  if (!res.ok) {
    const textResp = await res.text();
    const err = new Error(`Azure Speech error: ${textResp || res.status}`);
    err.code = 'AZURE_TTS_ERROR';
    err.statusCode = res.status;
    throw err;
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');
  return { base64Audio, mime: fmt.mime, voice: resolvedVoice };
}

function resolveVoice(language, requestedVoice) {
  if (requestedVoice) return requestedVoice;
  if (language && VOICE_MAP[language]) {
    return VOICE_MAP[language];
  }
  return VOICE_FALLBACK;
}

function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { callAzure };
