async function requestTTS(selectedText) {
	message = selectedText;
	const chosenUrl =
		activeCloud === "aws"
			? API_URL
			: "https://5tp98l0di6.execute-api.us-east-1.amazonaws.com/prod/tts";

	try {
		// Try to call the cloud TTS endpoint
		res = await fetch(chosenUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				text: message.text,     // Text to be read aloud
				language: message.language  // If it needs to be translated
			})
		});
	}
	catch (networkError) {
		/*console.warn("Network error detected, using offline fallback mode.", networkError);

		const synth = window.speechSynthesis;
		const utter = new SpeechSynthesisUtterance(selectedText);
		synth.speak(utter);


		alert("Using offline speech mode due to network or cloud failure.");*/

		//NOTE TO SELF, Make a catch for data
		return;
	}
	const data = await res.json();
	return data;

}



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type == 'TTS_REQUEST') {

		data = requestTTS(response.text);

		if (!data.success) {
			alert("TTS Error: " + (data.error?.message || "Unknown error"));
			return;
		}

		sendResponse({
			audioBase64: data.audioBase64,
			audioContentType: data.audioContentType
		});
		return true;
	}
});
