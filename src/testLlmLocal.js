// src/testLlmLocal.js
const { handler } = require('./llmHandler.js'); // or './llmHandler' if you renamed it

async function runTest() {
  // Mimic an API Gateway POST event to /llm
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      mode: 'simplify', // try 'summarize' as well
      requestId: 'local-llm-test-1',
      text: `This is a longish sample paragraph you want to simplify or summarize.
It should be enough text to see Azure OpenAI mini do something non-trivial.`
    })
  };

  const result = await handler(event);
  console.log('Lambda status:', result.statusCode);

  const body = JSON.parse(result.body || '{}');
  console.log('Lambda body:', body);

  if (body.success) {
    console.log('\n=== OUTPUT TEXT ===\n');
    console.log(body.outputText);
  } else {
    console.error('\nLLM error payload:', body);
  }
}

runTest().catch(console.error);
