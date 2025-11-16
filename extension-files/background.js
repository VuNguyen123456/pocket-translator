// background.js



// Call to LLM (this is the function from earlier)
async function callLlm(mode, text) {
	const LLM_API_URL = "https://5tp98l0di6.execute-api.us-east-1.amazonaws.com/prod/llm";


	const res = await fetch(LLM_API_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			mode,
			text,
			requestId: crypto.randomUUID() || Date.now().toString()
		})
	});

	const data = await res.json();

	if (data.success) {
		return data.outputText; // The simplified or summarized text
	}

	// Handle fallback
	if (data.fallbackText) {
		return data.fallbackText;
	}

	throw new Error(data.error?.message || "LLM call failed");
}







async function requestTTS(message) {

	const chosenUrl = "https://5tp98l0di6.execute-api.us-east-1.amazonaws.com/prod/tts";

	console.log(message.targetLanguage);
	// Try to call the cloud TTS endpoint
	const res = await fetch(chosenUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			text: message.text,     // Text to be read aloud
			sourceLanguage: message.sourceLanguage ?? null,
			targetLanguage: message.targetLanguage ?? null // If it needs to be translated
		})
	});
	if (!res.ok) {
		throw new Error(`HTTP error! status: ${res.status}`);
	}

	const data = await res.json();
	return data;


}



async function handleProcessText(message, sendResponse) {
	try {
		const rewrittenText = await callLlm("summarize", message.text);
		sendResponse({ rewrittenText });
	} catch (err) {
		console.error("LLM error:", err);
		sendResponse({ rewrittenText: "Error processing text" });
	}
}

async function handleTTS(message, sendResponse) {
	try {
		const data = await requestTTS(message);
		sendResponse({
			audioBase64: data.audioBase64,
			audioContentType: data.audioContentType
		});
	} catch (error) {
		console.error("TTS REQUEST FAILED:", error);

		sendResponse({
			audioBase64: null,
			audioContentType: null,
			error: "TTS failed"
		});
	}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type == 'TTS_REQUEST') {

		/*requestTTS(message).then(data => {
			// Send the response after the async request is complete
			sendResponse({
				audioBase64: data.audioBase64,
				audioContentType: data.audioContentType
			});
		}).catch((error) => {
			console.error("Error handling TTS request:", error);
			
		});
		// Return true to indicate an async response
		return true;*/
		handleTTS(message, sendResponse);
		return true;
	}
	if (message.type === "PROCESS_TEXT") {

		handleProcessText(message, sendResponse);
		return true;
	}
});
