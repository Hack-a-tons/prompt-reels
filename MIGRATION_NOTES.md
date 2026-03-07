# Migration from GPT-4.1 to GPT-5.4

## Changes Made

### 1. Removed Hardcoded Defaults
- **config.js**: Removed default values for `AZURE_DEPLOYMENT_NAME` and `AZURE_API_VERSION`
- Added validation to ensure all required Azure config values are present when `AI_PROVIDER=azure`
- System will now fail fast if required environment variables are missing

### 2. Updated API Parameters
- Changed all `max_tokens` to `max_completion_tokens` (GPT-5.4 requirement)
- Updated in:
  - `src/core/gemini.js` (5 occurrences)
  - `src/core/promptEvolution.js` (2 occurrences)

### 3. Updated Credentials
- **Endpoint**: `https://supergenia-hurated-resource.openai.azure.com`
- **Model**: `gpt-5.4`
- **API Version**: `2025-01-01-preview` (unchanged)
- Using same credentials as `~/Downloads/GitHub/Human-Rated-AI/video` project

### 4. Documentation Updates
- Updated README.md to reference GPT-5.4
- Updated .env.example with gpt-5.4

## Testing
✅ Server starts successfully
✅ Image description works with GPT-5.4
✅ Health check passes

## AI Provider Usage
Both Azure OpenAI (GPT-5.4) and Google Gemini are used for image recognition:
- Primary provider set by `AI_PROVIDER` env var
- Automatic fallback to alternate provider on failure
- Azure: Used for image descriptions, scene analysis, prompt evolution
- Gemini: Alternative provider for same tasks

## Deployment Notes
- Update `.env` on production server with new credentials
- No database migrations needed
- No breaking changes to API endpoints
