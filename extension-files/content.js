console.log("CONTENT SCRIPT LOADED");

let accessibilityEnabled = false;
let highContrastEnabled = false;
let adaModeEnabled = false;
let salesforceModeEnabled = false;


let styleTags = {}; // store multiple mode styles

// Common CSS for different modes
const modeCSS = {
    accessibility: `
    * {
        font-family: 'OpenDyslexic', Arial, sans-serif !important;
        letter-spacing: 0.5px !important;
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
    }

    body {
        background: #fafafa !important;
        color: #000 !important;
        font-size: 22px !important;
        line-height: 2 !important;
    }

    /* Reader-mode layout */
    p, span, div {
        max-width: 750px !important;
        margin-left: auto !important;
        margin-right: auto !important;
    }

    /* Remove clutter */
    nav, header, footer, aside, .ad, [role="banner"], [role="navigation"] {
        display: none !important;
    }

    /* Better selection */
    ::selection {
        background: #ffd54f !important;
        color: #000 !important;
    }
    `,

    highContrast: `
        html, body, div, span, p, a, li, ul, section, article, header, footer, nav, main, h1, h2, h3, h4, h5, h6, button{
            background: #000 !important;
            color: #fff !important;
        }

        code {
            background: #424242ff !important;
            color: #beb211ff !important;
        }
        a, button{
            color: #00ffff !important;
            text-decoration: underline !important;
        }
        img, video {
            filter: brightness(0.8) contrast(1.4) !important;
        }
        * {
            border-color: #fff !important;
        }
    `,
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


const accessibilityCSS = `
* {
    font-family: 'Arial', sans-serif !important;
    line-height: 1.6 !important;
}
body{
    font-size: 48px !important;
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

    switch (msg.action) {
        case "READ_SELECTED":
            const text = window.getSelection().toString().trim();
            sendResponse({ text });
            return true;

        case "TOGGLE_ACCESSIBILITY":
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
            sendResponse({ success: true, speed });
            return true;

        case "TOGGLE_SALESFORCE_MODE":
            document.getElementById("salesforceBtn").addEventListener("click", () => {
                const textToExport = currentTranslatedText || currentOriginalText;
                exportSalesforceNote({
                    pageTitle: document.title,
                    pageUrl: window.location.href,
                    text: textToExport
                });
            });

            return true;

        case "SET_LANGUAGE":
            if (msg.language) {
                document.documentElement.setAttribute("lang", msg.language);
                console.log("SET_LANGUAGE applied to page:", msg.language);
            }
            sendResponse({ success: true });
            return true;

        case "GET_FULL_PAGE_TEXT":

            const RAW_LIMIT = 12000; // stay safely below the ~13107 limit
            const fulltext = document.body.innerText || '';
            const sliced = fulltext.length > RAW_LIMIT ? fulltext.slice(0, RAW_LIMIT) : fulltext;

            sendResponse({ text: sliced });
            return true;

        default:
            console.warn("Unknown message:", msg);
            sendResponse({ success: false });
    }

});
