

let speed = 1.0;


document.addEventListener("DOMContentLoaded", () => {

    const readBtn = document.getElementById("readBtn");
    const translateBtn = document.getElementById("translateBtn");
    const accessibilityBtn = document.getElementById("playback");
    const languageSelect = document.getElementById("language-select");
    const salesforceBtn = document.getElementById("salesforceBtn");
    const highContrastBtn = document.getElementById("highContrastBtn");
    const playbackDropdown = document.getElementById("playback");


    function sendToActiveTab(message, callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]?.id) return;
            chrome.tabs.sendMessage(tabs[0].id, message, callback);
        });
    }

    readBtn.addEventListener("click", () => {
        sendToActiveTab({ action: "READ_SELECTED" }, (res) => {
            const text = res?.text || "";
            if (!text) { console.warn("No text selected."); return; }
            console.log("Selected text:", text);
            chrome.runtime.sendMessage({ type: "TTS_REQUEST", text, language: "en" });
        });
    });

    translateBtn.addEventListener("click", () => {
        const lang = languageSelect.value;
        chrome.runtime.sendMessage({ action: "TRANSLATE_READ", targetLang: lang }, response => {
            if (!response?.success) return console.warn("Translation failed:", response?.error);
            console.log("Translated text:", response.text);

            if (response.audioBase64) {
                //const audio = new Audio();
                audio.play();
            }
        });
    });

    //ADA mode
    /*playbackDropdown.addEventListener("change", (e) => {
        speed = e.target.value;

    });

    accessibilityBtn.addEventListener("click", () => {
        sendToActiveTab({ action: "TOGGLE_ACCESSIBILITY" });
    });


    salesforceBtn.addEventListener("click", () => {
        sendToActiveTab({ action: "TOGGLE_SALESFORCE" });
    });

    highContrastBtn.addEventListener("click", () => {
        sendToActiveTab({ action: "TOGGLE_HIGH_CONTRAST" });
    });

    languageSelect.addEventListener("change", (e) => {
        sendToActiveTab({ action: "SET_LANGUAGE", language: e.target.value });
    });*/

});




// Function to get full page text and process it
function processFullPageText() {
    // Step 1: Get the entire text from the body of the page
    const pageText = document.body.innerText;

    if (pageText) {
        // Step 2: Send the full page text to the background for LLM processing
        chrome.runtime.sendMessage(
            { type: "PROCESS_TEXT", text: pageText }, // Send the full page text to background.js
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error in background response:", chrome.runtime.lastError);
                    return;
                }

                if (response && response.rewrittenText) {
                    console.log("Rewritten text:", response.rewrittenText);
                    // Now you can do something with the rewritten text (e.g., pass it to TTS)
                    chrome.runtime.sendMessage({
                        type: "TTS_REQUEST",
                        text: response.rewrittenText,
                        language: "en"
                    });
                } else {
                    console.error("No rewritten text returned from background.");
                }
            }
        );
    } else {
        console.warn("No text found on the page.");
    }
}

// Add event listener for button click to process the full page text
document.getElementById("aiSummarizer").addEventListener("click", () => {
    processFullPageText(); // Call function to process the entire page text
});







document.getElementById("readBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "READ_SELECTED" },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("Message failed:", chrome.runtime.lastError.message);
                    return;
                }

                if (!response || !response.text) {
                    console.warn("No text selected.");
                    return;
                }

                const selectedText = response.text.trim();
                /*console.log(selectedText);*/


                chrome.runtime.sendMessage(
                    {
                        type: "TTS_REQUEST",
                        text: selectedText,
                        language: "en"
                    },
                    (ttsResponse) => {
                        if (chrome.runtime.lastError) {
                            console.error("TTS error:", chrome.runtime.lastError.message);
                            return;
                        }

                        if (ttsResponse?.audioBase64) {
                            console.log("Recieved Audio.");
                            const audio = new Audio(
                                `data:${ttsResponse.audioContentType};base64,${ttsResponse.audioBase64}`
                            );
                            audio.playbackRate = speed;
                            audio.play();
                        } else {
                            console.error("Failed to get TTS audio:", ttsResponse?.error);
                        }
                    }
                );
            }
        );
    });
});

