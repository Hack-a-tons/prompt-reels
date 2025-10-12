# Temporary Azure OpenAI Switch

## What Changed

Modified `src/core/gemini.js` to **prefer Azure OpenAI** over Gemini to bypass daily quota limits.

```javascript
// TEMPORARY: Prefer Azure over Gemini to avoid quota issues
// TODO: Switch back to Gemini when quota resets

// Try Azure OpenAI first if available
if (azureClient) {
  console.log('🔵 Using Azure OpenAI (bypassing Gemini quota limits)');
  // ... use Azure
}

// Fallback to Gemini if Azure not available
if (geminiClient) {
  // ... use Gemini with quota tracking
}
```

## Why This Works

- **Azure OpenAI**: Pay-per-use, no daily limits
- **Gemini**: Free tier with 50 requests/day limit (exhausted)
- **No code changes needed elsewhere**: Same API interface

## What You'll See

```
🔵 Using Azure OpenAI (bypassing Gemini quota limits)

[1/15] (6.7%) Evaluating: baseline @ news
   ✓ Score: 0.8234, Latency: 1841ms

[2/15] (13.3%) Evaluating: structured @ news
   ✓ Score: 0.8567, Latency: 1698ms
```

**No more:**
- ❌ `Rate limiting: waiting 30s...`
- ❌ `Daily quota: 50/50 exhausted`
- ❌ `429 Too Many Requests`

## Testing

1. **Restart your server** (if not using nodemon):
   ```bash
   npm run dev
   ```

2. **Run a test**:
   ```bash
   ./test.sh analyze
   ```

3. **Run FPO with all iterations**:
   ```bash
   curl -X POST http://localhost:15000/api/fpo/run \
     -H "Content-Type: application/json" \
     -d '{"iterations": 3}'
   ```

## When to Switch Back

When Gemini quota resets (midnight Pacific Time), you can switch back by reversing the order in `src/core/gemini.js`:

```javascript
// Switch back to Gemini first
if (geminiClient) {
  // ... use Gemini
}

// Fallback to Azure
if (azureClient) {
  // ... use Azure
}
```

## Current Status

✅ Azure OpenAI is now the primary AI provider  
✅ No rate limiting delays  
✅ Full FPO runs possible  
🔄 Gemini kept as fallback (but won't be used with Azure configured)
