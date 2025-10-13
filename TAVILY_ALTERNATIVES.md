# Tavily Alternatives - News Fetching Options

When Tavily hits usage limits (HTTP 432), you have **3 alternatives**:

---

## ✅ Option 1: Automatic RSS Fallback (Recommended)

**What it does:** Automatically switches to RSS feeds when Tavily fails.

**How to use:** No changes needed! Already enabled by default.

```bash
# Works automatically - tries Tavily first, falls back to RSS
./scripts/fetch-news.sh
```

**RSS Sources (13 major news sites):**
- CNN, NBC News, ABC News, Fox News, CBS News
- The Verge, CNET, TechCrunch
- Bloomberg, CNBC
- BBC, Al Jazeera, Reuters

**Advantages:**
- ✅ Free, no API keys
- ✅ Automatic fallback
- ✅ 13 major news sources
- ✅ High-quality articles

**Disadvantages:**
- ⚠️ No search query (gets latest news)
- ⚠️ May take longer to find videos

---

## ✅ Option 2: Manual URL Input (Best for specific articles)

**What it does:** Provide a specific article URL, bypasses search entirely.

**How to use:**

```bash
# From command line
./scripts/fetch-from-url.sh "https://www.cnn.com/2025/01/10/article-with-video"

# Via API
curl -X POST https://reels.hurated.com/api/fetch-from-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
```

**Advantages:**
- ✅ No search API needed (bypasses Tavily)
- ✅ Direct control over articles
- ✅ Still uses BrowserBase for video extraction
- ✅ Fast when you know the URL

**Use cases:**
- You found a specific article with a video
- Testing with known URLs
- Tavily is down/quota exceeded

---

## 🔧 Option 3: Alternative Search APIs (Future)

If you need search functionality, consider these free tiers:

| Service | Free Tier | Setup |
|---------|-----------|-------|
| **Google Custom Search** | 100 queries/day | Add `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID` to `.env` |
| **Bing Search API** | 1000 queries/month | Add `BING_SEARCH_API_KEY` to `.env` |
| **SerpAPI** | 100 searches/month | Add `SERPAPI_KEY` to `.env` |

*Note: Implementation not included yet. Open an issue if needed.*

---

## 🎯 How RSS Fallback Works

When `fetchNewsArticle()` is called:

1. **Try Tavily first** with exponential backoff (3, 6, 12, 24, 48, 96 articles)
2. **If Tavily fails** (HTTP 432, timeout, etc.):
   - Log: `⚡ Falling back to RSS feeds (free, no API needed)...`
   - Fetch 50 articles from 13 RSS feeds
   - Continue with normal video extraction
3. **BrowserBase extracts video** from articles (same as before)
4. **Download and analyze** as usual

**Code location:**
- `src/core/rssFetcher.js` - RSS feed parser
- `src/core/newsFetcher.js` - Automatic fallback logic

---

## 📝 Testing

### Test RSS Fallback
```bash
# RSS fallback will trigger automatically if Tavily is down
./scripts/fetch-news.sh

# Or test directly in Node.js
node -e "require('./src/core/rssFetcher').fetchFromRSSFeeds(5).then(console.log)"
```

### Test Manual URL
```bash
# Good test URLs (news sites with video):
./scripts/fetch-from-url.sh "https://www.cnn.com/latest"
./scripts/fetch-from-url.sh "https://www.nbcnews.com/news"
./scripts/fetch-from-url.sh "https://www.theverge.com/tech"
```

---

## 🚀 Production Deployment

**Changes are backward compatible!** No `.env` updates needed.

```bash
# Deploy with new features
./scripts/deploy.sh -m "Add RSS fallback and manual URL input"

# Test on production
./scripts/fetch-from-url.sh "https://www.cnn.com/some-article"
```

---

## 🔍 Troubleshooting

### "Tavily failed: Request failed with status code 432"
✅ **Expected!** RSS fallback will activate automatically.

### "No articles with downloadable videos found"
This happens when:
- Articles don't have embedded videos
- Videos are behind paywalls
- BrowserBase can't extract video URLs

**Solutions:**
- Try manual URL with known video article
- Use news sites known for video content (CNN, NBC, BBC)
- Check BrowserBase quota (you're still using it)

### "Failed to fetch article from provided URL"
Check:
- URL is valid and accessible
- Article has an embedded video
- BrowserBase API key is configured
- Video isn't behind authentication

---

## 📊 Monitoring

Watch logs to see which source is used:

```bash
# Check production logs
ssh reels.hurated.com "docker compose -f prompt-reels/compose.yml logs -f" | grep -i "rss\|tavily"

# You'll see:
# "Tavily failed: Request failed with status code 432"
# "⚡ Falling back to RSS feeds (free, no API needed)..."
# "RSS feeds returned 47 articles"
# "✓ Success! Found video after checking 12 articles (source: RSS feeds)"
```

---

## 💡 Pro Tips

1. **RSS is slower but reliable** - Gets latest news without API limits
2. **Manual URL is fastest** - When you know what you want
3. **BrowserBase still required** - For video extraction (no alternative)
4. **Mix approaches** - Use RSS for batch, manual URL for specific articles

---

## 🆘 Need Help?

- Check logs: `docker compose logs -f`
- Test RSS: `node -e "require('./src/core/rssFetcher').fetchFromRSSFeeds(5).then(console.log)"`
- Test URL fetch: `./scripts/fetch-from-url.sh "https://www.cnn.com"`
- Open issue on GitHub with error details
