# PatriotRead

A comprehensive browser extension that makes websites more accessible through Text-to-Speech (TTS), AI-powered summarization, visual accessibility modes, and more. Built for PatriotHacks hackathon.

[https://www.youtube.com/watch?v=RzfKe3H4noU](https://www.youtube.com/watch?v=RzfKe3H4noU)
## 🎯 Features

### Core Features
- **🔊 Text-to-Speech (TTS)**: Read selected text aloud with customizable speed and language
- **🤖 AI Summarizer**: Automatically summarize entire web pages using Azure OpenAI
- **⇄ Accessibility Mode**: Reader-friendly mode with larger fonts and simplified layout
- **🌓 High Contrast Mode**: Enhanced contrast for better visibility
- **➜ Salesforce Export**: Export selected text as Salesforce notes
- **📋 Summary Management**: Copy and download AI-generated summaries

## 📦 Installation

### For End Users (Loading the Extension)

1. **Download the Extension**
   - Clone this repository or download the `extension-files` folder

2. **Load in Chrome/Edge**
   - Open Chrome/Edge and navigate to:
     - Chrome: `chrome://extensions`
     - Edge: `edge://extensions`
   - Enable **Developer mode** (toggle in top-right corner)
   - Click **"Load unpacked"**
   - Select the `extension-files` folder from this repository
   - The extension icon should appear in your toolbar

3. **Verify Installation**
   - Click the extension icon to open the popup
   - You should see all the buttons and options

### Prerequisites
- Chrome or Edge browser (Chromium-based)
- Active internet connection (for AWS/Azure services)

## 🎮 User Guide

### Button Functions

#### 🔊 Read Selected Text
- **What it does**: Reads the currently selected text on the page aloud
- **How to use**:
  1. Select any text on a webpage
  2. Click the extension icon
  3. Click "🔊 Read Selected Text"
  4. Audio will play automatically
- **Settings**: Adjust playback speed using the "Playback Speed" dropdown

#### 🤖 AI Summarizer
- **What it does**: Uses Azure OpenAI to summarize the entire webpage content
- **How to use**:
  1. Navigate to any webpage
  2. Click the extension icon
  3. Click "🤖 AI Summarizer"
  4. Wait for processing (may take 10-30 seconds)
  5. Summary appears in the "AI Summary" box
- **Features**:
  - Automatically truncates long pages to stay within limits
  - Handles rate limits with automatic retries
  - Copy summary with ⿻ button
  - Download summary with ⬇ button
- **Note**: Wait 1-2 minutes between requests to avoid rate limits

#### ⇄ Toggle Accessibility
- **What it does**: Applies accessibility-friendly styling to the page
- **Features**:
  - Larger fonts (22px base, 48px body)
  - Increased line spacing
  - Reader-mode layout (max-width 750px)
  - Removes navigation, ads, and clutter
  - Better text selection highlighting
- **How to use**: Click the button to toggle on/off

#### 🌓 High Contrast Mode
- **What it does**: Applies high contrast styling for better visibility
- **Features**:
  - Black background, white text
  - Enhanced link visibility (cyan)
  - Improved image contrast
  - Better border visibility
- **How to use**: Click the button to toggle on/off

#### ➜ Export: Salesforce Note
- **What it does**: Exports selected text as a formatted Salesforce note
- **How to use**:
  1. Select text on a webpage
  2. Click "➜ Export: Salesforce Note"
  3. A formatted note file downloads with:
     - Page title
     - Page URL
     - Selected text
     - Timestamp

### Settings

#### Language Selection
- Choose from: English (🇺🇸), Spanish (🇪🇸), French (🇫🇷)
- Affects TTS language and page language attribute

#### Playback Speed
- Options: 1x, 0.75x, 0.5x, 0.25x
- Controls TTS reading speed

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐
│  Browser        │
│  Extension      │
│  (popup.js,     │
│   content.js,   │
│   background.js)│
└────────┬────────┘
         │
         │ HTTPS POST
         ▼
┌─────────────────┐
│  AWS API        │
│  Gateway        │
└────────┬────────┘
         │
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  AWS Lambda     │─────▶│  Azure OpenAI    │
│  (/llm handler) │      │  (Summarization) │
└────────┬────────┘      └──────────────────┘
         │
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  AWS Lambda     │─────▶│  Azure Speech     │
│  (/tts handler) │      │  (Text-to-Speech) │
└─────────────────┘      └──────────────────┘
```

### Component Breakdown

#### Frontend (Extension)
- **popup.html/js**: Extension UI and button handlers
- **content.js**: Injected into web pages, handles text selection and styling
- **background.js**: Service worker, handles API calls to AWS
- **manifest.json**: Extension configuration and permissions

#### Backend (AWS Lambda)
- **llmHandler.js**: Handles AI summarization requests
- **handler.js**: Handles TTS requests
- **azureLlmClient.js**: Azure OpenAI client with chunking and retry logic
- **azureClient.js**: Azure Speech Services client

## ☁️ AWS Setup

### Prerequisites
- AWS Account
- AWS CLI configured (optional, for local testing)
- Node.js 18+ installed

### Lambda Functions Setup

#### 1. Create Lambda Functions

Create two Lambda functions:
- `/llm` - For AI summarization
- `/tts` - For text-to-speech

#### 2. Deploy Code

**For `/llm` Lambda:**
```bash
# Create deployment package
zip -r llm-lambda.zip src/llmHandler.js src/azureLlmClient.js src/azureClient.js src/utils.js node_modules/

# Upload via AWS Console:
# 1. Go to Lambda function
# 2. Code tab → Upload from → .zip file
# 3. Select llm-lambda.zip
```

**For `/tts` Lambda:**
```bash
# Create deployment package
zip -r lambda.zip src/handler.js src/azureClient.js src/utils.js node_modules/

# Upload via AWS Console
```

#### 3. Configure Environment Variables

**For `/llm` Lambda:**
```
LLM_MAX_TEXT_LENGTH=4000
LLM_MAX_INPUT_CHARS=4000
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

**For `/tts` Lambda:**
```
AZURE_SPEECH_KEY=your-speech-key
AZURE_SPEECH_REGION=your-region
AZURE_TRANSLATOR_KEY=your-translator-key (optional)
AZURE_TRANSLATOR_REGION=your-region (optional)
MAX_TEXT_LENGTH=5000
DEFAULT_LANGUAGE=en-US
```

#### 4. Set Handler

- **Runtime**: Node.js 18.x or later
- **Handler**: 
  - `/llm`: `src/llmHandler.handler` (or `llmHandler.handler` if files at root)
  - `/tts`: `src/handler.handler` (or `handler.handler` if files at root)

#### 5. Configure API Gateway

1. Create REST API in API Gateway
2. Create two resources:
   - `POST /llm`
   - `POST /tts`
3. Connect each to respective Lambda function
4. Enable CORS on both endpoints
5. Deploy API to a stage (e.g., `prod`)
6. Note the API endpoint URL

#### 6. Update Extension

Update `extension-files/background.js` with your API Gateway endpoint:
```javascript
const LLM_API_URL = "https://YOUR-API-ID.execute-api.REGION.amazonaws.com/prod/llm";
const TTS_API_URL = "https://YOUR-API-ID.execute-api.REGION.amazonaws.com/prod/tts";
```

Also update `extension-files/manifest.json`:
```json
"host_permissions": [
  "<all_urls>",
  "https://YOUR-API-ID.execute-api.REGION.amazonaws.com/prod/tts",
  "https://YOUR-API-ID.execute-api.REGION.amazonaws.com/prod/llm"
]
```

### AWS Costs
- Lambda: Free tier includes 1M requests/month
- API Gateway: Free tier includes 1M requests/month
- CloudWatch: Minimal costs for logs

## 🔷 Azure Setup

### Prerequisites
- Azure Account
- Azure OpenAI Service resource
- Azure Speech Services resource

### Azure OpenAI Setup (for AI Summarizer)

1. **Create Azure OpenAI Resource**
   - Go to Azure Portal
   - Create "Azure OpenAI" resource
   - Note the endpoint URL

2. **Deploy Model**
   - Go to your Azure OpenAI resource
   - Navigate to "Deployments"
   - Create a deployment (e.g., `gpt-4o-mini` or `gpt-4.1-mini`)
   - Note the deployment name

3. **Get API Key**
   - Go to "Keys and Endpoint" in your resource
   - Copy one of the keys

4. **Configure Rate Limits**
   - Default S0 tier has limited TPM (tokens per minute)
   - For production, consider upgrading tier or requesting quota increase
   - Current code handles rate limits with retry logic

### Azure Speech Services Setup (for TTS)

1. **Create Speech Resource**
   - Go to Azure Portal
   - Create "Speech Services" resource
   - Note the region and endpoint

2. **Get API Key**
   - Go to "Keys and Endpoint"
   - Copy one of the keys

3. **Configure in Lambda**
   - Set `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` environment variables

### Azure Translator (Optional)

If you want translation features:
1. Create "Translator" resource in Azure
2. Get API key and region
3. Set `AZURE_TRANSLATOR_KEY` and `AZURE_TRANSLATOR_REGION` in Lambda

### Azure Costs
- **Azure OpenAI**: Pay-per-token (varies by model)
  - GPT-4o-mini: ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
- **Speech Services**: Pay-per-character
  - Standard TTS: ~$15 per 1M characters
- **Translator**: Pay-per-character
  - Standard: ~$10 per 1M characters

## 🚀 Local Development

### Prerequisites
```bash
node --version  # Should be 18+
npm --version
```

### Install Dependencies
```bash
npm install
```

### Test Lambda Locally

**Test LLM Handler:**
```bash
node src/testLlmLocal.js
```

**Test TTS Handler:**
```bash
node src/testLocalRequest.js
```

### Run Mock Azure Server (Optional)
```bash
node src/mockAzure.js
# Server runs on http://localhost:3000
```

### Load Extension for Testing
1. Make changes to extension files
2. Go to `chrome://extensions`
3. Click reload on your extension
4. Test changes

## 📁 Project Structure

```
accessibility-api/
├── extension-files/          # Browser extension code
│   ├── manifest.json         # Extension configuration
│   ├── popup.html            # Extension UI
│   ├── popup.js              # UI logic and button handlers
│   ├── popup.css             # Extension styling
│   ├── background.js         # Service worker (API calls)
│   ├── content.js            # Content script (injected into pages)
│   └── icon16.png            # Extension icon
├── src/                      # AWS Lambda handlers
│   ├── llmHandler.js         # AI summarization handler
│   ├── handler.js            # TTS handler
│   ├── azureLlmClient.js     # Azure OpenAI client
│   ├── azureClient.js        # Azure Speech client
│   ├── utils.js              # Shared utilities
│   ├── mockAzure.js          # Mock Azure server for testing
│   ├── testLlmLocal.js       # Local LLM testing
│   └── testLocalRequest.js   # Local TTS testing
├── node_modules/             # npm dependencies
├── package.json              # Node.js dependencies
├── llm-lambda.zip            # Deployment package for /llm
├── lambda.zip                # Deployment package for /tts
└── README.md                 # This file
```

## 🔧 Configuration

### Extension Configuration

**manifest.json** - Update API endpoints:
```json
"host_permissions": [
  "<all_urls>",
  "https://YOUR-API-ID.execute-api.REGION.amazonaws.com/prod/tts",
  "https://YOUR-API-ID.execute-api.REGION.amazonaws.com/prod/llm"
]
```

**background.js** - Update API URLs:
```javascript
const LLM_API_URL = "https://YOUR-API-ID.execute-api.REGION.amazonaws.com/prod/llm";
const TTS_API_URL = "https://YOUR-API-ID.execute-api.REGION.amazonaws.com/prod/tts";
```

### Lambda Configuration

**Text Length Limits:**
- `LLM_MAX_TEXT_LENGTH`: Maximum text length before rejection (default: 4000)
- `LLM_MAX_INPUT_CHARS`: Maximum characters sent to LLM (default: 4000)
- `MAX_TEXT_LENGTH`: Maximum text for TTS (default: 5000)

**Rate Limiting:**
- Code includes automatic retry with exponential backoff
- Chunking for long pages (splits into 4000-char chunks)
- Delays between chunk processing (3 seconds default)

## 🐛 Troubleshooting

### Extension Not Loading
- **Check**: Developer mode enabled in `chrome://extensions`
- **Check**: Selected the correct folder (`extension-files`, not parent folder)
- **Check**: No errors in extension console

### TTS Not Working
- **Check**: AWS Lambda environment variables set correctly
- **Check**: Azure Speech Services key is valid
- **Check**: API Gateway endpoint URL is correct in `background.js`
- **Check**: CORS enabled on API Gateway endpoint
- **Check**: Browser console for error messages

### AI Summarizer Not Working
- **Check**: AWS Lambda environment variables for Azure OpenAI
- **Check**: Azure OpenAI deployment name matches
- **Check**: Rate limits - wait 1-2 minutes between requests
- **Check**: CloudWatch logs for detailed error messages
- **Check**: Text length - very long pages may be truncated

### Rate Limit Errors
- **Symptom**: "Rate limit exceeded" errors
- **Solution**: Wait 1-2 minutes between requests
- **Solution**: Upgrade Azure tier for higher limits
- **Solution**: Code includes automatic retry - check CloudWatch logs

### "Text exceeds maximum length" Error
- **Symptom**: Error when summarizing long pages
- **Solution**: Increase `LLM_MAX_TEXT_LENGTH` env var (but stay under Azure limits)
- **Solution**: Code automatically truncates - this is expected behavior

### Extension Shows Original Text Instead of Summary
- **Symptom**: Second request shows full page text
- **Cause**: Rate limit hit, Lambda returned fallback text
- **Solution**: Wait 1-2 minutes between requests
- **Solution**: Check CloudWatch logs for rate limit errors

## 🔒 Security Notes

- **API Keys**: Never commit API keys to git
- **Environment Variables**: Store all secrets in Lambda environment variables
- **CORS**: API Gateway handles CORS automatically
- **HTTPS**: All API calls use HTTPS
- **Permissions**: Extension only requests necessary permissions

## 📝 API Endpoints

### POST /llm
**Request:**
```json
{
  "mode": "summarize" | "simplify",
  "text": "Text to summarize...",
  "requestId": "optional-request-id"
}
```

**Response (Success):**
```json
{
  "success": true,
  "requestId": "request-id",
  "mode": "summarize",
  "outputText": "Summary text...",
  "source": "azure-openai-mini"
}
```

**Response (Error):**
```json
{
  "success": false,
  "requestId": "request-id",
  "mode": "summarize",
  "error": {
    "code": "LAMBDA_LLM_ERROR",
    "message": "Error message"
  },
  "fallbackText": "Original text..."
}
```

### POST /tts
**Request:**
```json
{
  "text": "Text to read aloud",
  "language": "en-US",
  "format": "audio/mp3"
}
```

**Response (Success):**
```json
{
  "success": true,
  "requestId": "request-id",
  "audioBase64": "base64-encoded-audio...",
  "audioContentType": "audio/mpeg",
  "language": "en-US",
  "voice": "en-US-JennyNeural"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC License

## 🙏 Acknowledgments

- Built for PatriotHacks hackathon
- Uses Azure OpenAI for AI summarization
- Uses Azure Speech Services for TTS
- Hosted on AWS Lambda and API Gateway

## 📧 Support

For issues or questions:
1. Check the Troubleshooting section
2. Review CloudWatch logs for detailed errors
3. Check browser console for extension errors
4. Open an issue on GitHub

---

**Note**: This extension requires active AWS and Azure services. Make sure your API keys and endpoints are configured correctly before use.

