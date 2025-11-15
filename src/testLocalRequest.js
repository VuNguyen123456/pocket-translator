// src/testLocalRequest.js
const fs = require('fs');
const handler = require('./handler').handler;

async function runTest() {
  // Mimic the API Gateway event body we expect in production.
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      requestId: "test-req-1",
      text: "Hello from local test. This is a demo.",
      language: "en-US",
      format: "audio/mp3"
    })
  };

  // Directly invoke the Lambda handler (no AWS infra needed).
  const result = await handler(event);
  console.log("Lambda response:", result);
  const body = JSON.parse(result.body);
  if (body.success && body.audioBase64) {
    const fileExt = body.audioContentType === 'audio/wav' ? 'wav' : 'mp3';
    const fileName = `out.${fileExt}`;
    const b = Buffer.from(body.audioBase64, 'base64');
    fs.writeFileSync(fileName, b);
    console.log(`Wrote ${fileName} (may be silent if mock).`);
  } else {
    console.error('Lambda returned error payload:', body);
  }
}

runTest().catch(console.error);
