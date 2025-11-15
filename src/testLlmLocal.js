// src/testLlmLocal.js
// Local runner to call the /llm Lambda handler without AWS.

const { handler } = require('./llmHandler');

async function runSingleTest(mode) {
  console.log('\n==============================');
  console.log(`Running local LLM test for mode="${mode}"`);
  console.log('==============================\n');

  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      mode,
      requestId: `local-llm-test-${mode}`,
      text: `This is a longish sample paragraph you want to ${mode}. 
It should be enough text to see Azure OpenAI mini do something non-trivial and produce useful output.`,
    }),
  };

  const result = await handler(event);
  console.log('Lambda status:', result.statusCode);

  const body = JSON.parse(result.body || '{}');
  console.log('Lambda body:', body);

  if (body.success) {
    console.log('\n=== OUTPUT TEXT ===\n');
    console.log(body.outputText);
  } else {
    console.error('\nLLM error payload:', body.error);
    if (body.fallbackText) {
      console.log('\n=== FALLBACK TEXT ===\n');
      console.log(body.fallbackText);
    }
  }
}

async function runTest() {
  await runSingleTest('summarize');
}

runTest().catch(console.error);
