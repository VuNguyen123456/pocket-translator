console.log("CONTENT SCRIPT LOADED");

let accessibilityEnabled = false;
let highContrastEnabled = false;
let adaModeEnabled = false;
let salesforceModeEnabled = false;


let styleTags = {}; // store multiple mode styles

// Common CSS for different modes
const modeCSS = {
    accessibility: `
        * { font-family: 'Arial', sans-serif !important; line-height: 1.6 !important; }
        body { font-size: 20px !important; background: #ffffff !important; color: #000000 !important; }
    `,
    highContrast: `
        body { background: #000 !important; color: #fff !important; }
        a { color: #0ff !important; }
    `,
    adaMode: `
        body { font-size: 22px !important; line-height: 1.8 !important; }
        * { outline: 1px solid #000 !important; }
    `,
    salesforce: `
        body { background: #f4f6f9 !important; color: #16325c !important; font-family: 'Salesforce Sans', sans-serif !important; }
    `

};

// Helper to toggle styles
function toggleModeStyle(mode, enabled) {
    if (enabled) {
        if (styleTags[mode]) return; // already applied
        const styleTag = document.createElement("style");
        styleTag.id = `mode-style-${mode}`;
        styleTag.textContent = modeCSS[mode];
        document.head.appendChild(styleTag);
        styleTags[mode] = styleTag;
    } else {
        if (!styleTags[mode]) return;
        styleTags[mode].remove();
        delete styleTags[mode];
    }
}

/* I DONT END UP USING THIS!! WE USE IT INSIDE THE READ_SELECTED SIGNATURE
function getSelectedText() {
    return window.getSelection().toString().trim();
}*/


const accessibilityCSS = `
* {
    font-family: 'Arial', sans-serif !important;
    line-height: 1.6 !important;
}
body{
    font-size: 20px !important;
    background: #ffffff !important;
    color: #000000 !important;
}
`;

let styleTag = null;

function enableAccessibilityMode() {
    if (styleTag) return;

    styleTag = document.createElement("style");
    styleTag.id = "accessibility-mode-style";
    styleTag.textContent = accessibilityCSS;
    document.head.appendChild(styleTag);

    accessibilityEnabled = true;
}

function disableAccessibilityMode() {
    if (!styleTag) return;

    styleTag.remove();
    styleTag = null;

    accessibilityEnabled = false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    /*if (msg.action === "READ_SELECTED") {
        const text = window.getSelection().toString().trim();
        sendResponse({ text });
        return true;
    }*/
    switch (msg.action) {
        case "READ_SELECTED":
            const text = window.getSelection().toString().trim();
            sendResponse({ text });
            return true;

        case "TOGGLE_ACCESSIBILITY_MODE":
            accessibilityEnabled = !accessibilityEnabled;
            toggleModeStyle("accessibility", accessibilityEnabled);
            sendResponse({ enabled: accessibilityEnabled });
            return true;

        case "TOGGLE_HIGH_CONTRAST":
            highContrastEnabled = !highContrastEnabled;
            toggleModeStyle("highContrast", highContrastEnabled);
            sendResponse({ enabled: highContrastEnabled });
            return true;

        case "SET_PLAYBACK_SPEED":
            const speed = parseFloat(msg.speed) || 1;
            // Example: adjust font size proportionally to speed
            toggleModeStyle("adaMode", true); // ensure adaMode styles are applied
            const styleTag = styleTags["adaMode"];
            if (styleTag) {
                styleTag.textContent = `
                    body { font-size: ${20 * speed}px !important; line-height: ${1.8 * speed} !important; }
                    * { outline: 1px solid #000 !important; }
                `;
            }
            sendResponse({ success: true, speed });
            return true;

        case "TOGGLE_SALESFORCE_MODE":
            salesforceModeEnabled = !salesforceModeEnabled;
            toggleModeStyle("salesforce", salesforceModeEnabled);
            sendResponse({ enabled: salesforceModeEnabled });
            return true;

        case "SET_LANGUAGE":
            if (msg.language) {
                document.documentElement.setAttribute("lang", msg.language);
                console.log("SET_LANGUAGE applied to page:", msg.language);
            }
            sendResponse({ success: true });
            return true;

        case "TRANSLATE_READ":
            // Placeholder: you can integrate translation API here
            console.log("TRANSLATE_READ requested for targetLang:", msg.targetLang);
            sendResponse({ success: true });
            return true;

        default:
            console.warn("Unknown message:", msg);
            sendResponse({ success: false });
    }

});

/*
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
        case "READ_SELECTED":
            const text = window.getSelection().toString().trim();
            sendResponse({ text });
            return true;

        case "TOGGLE_ACCESSIBILITY_MODE":
            if (accessibilityEnabled) {
                disableAccessibilityMode();
            } else {
                enableAccessibilityMode();
            }
            sendResponse({ enabled: accessibilityEnabled });
            return true;
        default:
            console.warn("Unknown message:", msg);
    }
});*/