// Powered by Chatgpt + PatriotRead team
// src/testLlmLocal.js
// Local runner to call the /llm Lambda handler without AWS.

const { handler } = require('./llmHandler');

async function runSingleTest(mode, withTts = false) {
  console.log('\n==============================');
  console.log(
    `Running local LLM test for mode="${mode}"` +
      (withTts ? ' (with TTS)' : ' (text only)')
  );
  console.log('==============================\n');

  const body = {
    mode,
    requestId: `local-llm-test-${mode}${withTts ? '-tts' : ''}`,
    text: `This is a longish sample paragraph you want to ${mode}.
It should be enough text to see Azure OpenAI mini do something non-trivial and produce useful output.`,
  };

  // If we want TTS, add the tts block
  if (withTts) {
    body.tts = {
      enabled: true,
      language: 'en-US',
      format: 'audio/mp3',
      voice: 'default',
    };
  }

  const event = {
    httpMethod: 'POST',
    body: JSON.stringify(body),
  };

  const result = await handler(event);
  console.log('Lambda status:', result.statusCode);

  const parsed = JSON.parse(result.body || '{}');
  console.log('Lambda body keys:', Object.keys(parsed));
  console.log('success:', parsed.success);
  console.log('mode:', parsed.mode);
  console.log('outputText length:', parsed.outputText && parsed.outputText.length);

  if (parsed.tts) {
    console.log('TTS present ✅');
    console.log('audioBase64 length:', parsed.tts.audioBase64.length);
    console.log('audioContentType:', parsed.tts.audioContentType);
  } else {
    console.log('No TTS in response.');
  }

  if (!parsed.success) {
    console.error('\nLLM error payload:', parsed.error);
    if (parsed.fallbackText) {
      console.log('\n=== FALLBACK TEXT ===\n');
      console.log(parsed.fallbackText);
    }
  } else {
    console.log('\n=== OUTPUT TEXT (first 400 chars) ===\n');
    console.log((parsed.outputText || '').slice(0, 400));
  }
}

async function runTest() {
  // 1) Text only
  //await runSingleTest('summarize', false);

  // 2) Text + TTS
  await runSingleTest('summarize', true);
}

runTest().catch(console.error);
