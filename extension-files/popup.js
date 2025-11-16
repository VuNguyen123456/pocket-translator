

let speedPlay = 1.0;
let lang = "";


document.addEventListener("DOMContentLoaded", () => {

    const readBtn = document.getElementById("readBtn");
    const accessibilityBtn = document.getElementById("accessibilityModeBtn");
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


    //ADA mode
    playbackDropdown.addEventListener("change", (e) => {

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "SET_PLAYBACK_SPEED", speed: e.target.value }, (res) => {
                console.log("Playback speed applied:", res);
                speedPlay = res.speed;
            });
        });
    });

    accessibilityBtn.addEventListener("click", () => {
        sendToActiveTab({ action: "TOGGLE_ACCESSIBILITY" });
        accessibilityBtn.classList.toggle("active");  // only this button stays on/off
    });


    salesforceBtn.addEventListener("click", () => {
        // sendToActiveTab({ action: "TOGGLE_SALESFORCE" });
        // salesforceBtn.addEventListener("click", () => {
        //     const textToExport = currentTranslatedText || currentOriginalText;
        //     exportSalesforceNote({
        //         pageTitle: document.title,
        //         pageUrl: window.location.href,
        //         text: textToExport
        //     });
        // });
    });

    highContrastBtn.addEventListener("click", () => {
        sendToActiveTab({ action: "TOGGLE_HIGH_CONTRAST" });
        highContrastBtn.classList.toggle("active");  // only this button stays on/off
    });

    languageSelect.addEventListener("change", (e) => {
        lang = e.target.value;
        sendToActiveTab({ action: "SET_LANGUAGE", language: lang });
        spawnLanguageParticles();
    });

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
                        sourceLanguage: "",
                        targetLanguage:lang
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
                            audio.playbackRate = speedPlay;
                            audio.play();

                            //spawnLanguageParticles();
                        } else {
                            console.error("Failed to get TTS audio:", ttsResponse?.error);
                        }
                    }
                );
            }
        );
    });
});

function spawnLanguageParticles() {
const chars = [
        "A","B","C","あ","字","語","ब","ك","Ω","Й","ñ","á","é","ü","ß",
        "한","글","ض","ش","क","ह","你","我","한","語","є","δ"
    ];

    const dropdown = document.getElementById("language-select");
    if (!dropdown) return;

    const rect = dropdown.getBoundingClientRect();

    // Popup root
    const popup = document.body;

    for (let i = 0; i < 30; i++) {
        const el = document.createElement("div");
        el.className = "language-particle";

        el.textContent = chars[Math.floor(Math.random() * chars.length)];

        // Position relative to popup
        const offsetX = rect.left + rect.width / 2 - popup.offsetLeft;
        const offsetY = rect.top + rect.height / 2 - popup.offsetTop;

        el.style.left = offsetX + "px";
        el.style.top = offsetY + "px";

        // Random direction burst (strong outward)
        const angle = Math.random() * Math.PI * 2; // 0–360° rad
        const distance = 40 + Math.random() * 60; // px distance

        el.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        el.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);

        // Bright confetti colors
        el.style.color = `hsl(${Math.random() * 360}, 85%, 60%)`;

        popup.appendChild(el);

        // Remove after animation ends
        setTimeout(() => el.remove(), 1000);
    }
}


function exportSalesforceNote({ pageTitle, pageUrl, text }) {
    const payload = {
        attributes: {
        type: "Note",
        referenceId: "Webpage_Accessibility_Note"
        },
        Title: `Accessibility note: ${pageTitle || pageUrl || "Unknown page"}`,
        Body: text
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "salesforce-note.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
