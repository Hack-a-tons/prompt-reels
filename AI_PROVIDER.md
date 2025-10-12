# AI Provider Configuration

## Simple Provider Switch

Set your preferred AI provider in `.env`:

```bash
AI_PROVIDER=azure    # Use Azure OpenAI (default)
# or
AI_PROVIDER=gemini   # Use Google Gemini
```

## How It Works

- The system uses your selected provider for image descriptions
- If the current provider fails, it automatically switches to the other
- The system remembers which provider worked last
- Embeddings use simple hash-based similarity (no setup needed)

## Current Setup

Your configuration:
- **Azure OpenAI**: GPT-4.1 deployment ✅
- **Google Gemini**: gemini-2.5-pro
- **Embeddings**: Hash-based (no external API needed)

## Switching Providers

### To use Azure OpenAI (recommended for you)
```bash
AI_PROVIDER=azure
```

### To use Google Gemini
```bash
AI_PROVIDER=gemini
```

That's it! No complex setup, no quota warnings, just works.
