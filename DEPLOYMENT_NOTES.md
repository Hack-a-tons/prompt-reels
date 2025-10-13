# Deployment Notes - RSS Fallback & Manual URL Input

## 🎯 What Changed

Added **two alternatives** to Tavily API for news fetching when you hit usage limits.

### New Files
- `src/core/rssFetcher.js` - RSS feed parser (13 major news sources)
- `scripts/fetch-from-url.sh` - CLI for manual URL input
- `TAVILY_ALTERNATIVES.md` - Complete guide for alternatives

### Modified Files
- `src/core/newsFetcher.js` - Added automatic RSS fallback
- `src/api/routes.js` - Added POST `/api/fetch-from-url` endpoint

---

## ✅ Features

### 1. Automatic RSS Fallback
```javascript
// In src/core/newsFetcher.js
// When Tavily fails (HTTP 432, timeout, etc.), automatically switches to RSS feeds
const articleData = await fetchNewsArticle(query); // Handles fallback internally
```

**RSS Sources (13 sites):**
- US News: CNN, NBC, ABC, Fox, CBS
- Tech: The Verge, CNET, TechCrunch  
- Business: Bloomberg, CNBC
- International: BBC, Al Jazeera, Reuters

### 2. Manual URL Input
```bash
# CLI
./scripts/fetch-from-url.sh "https://www.cnn.com/article-with-video"

# API
POST /api/fetch-from-url
Body: { "url": "https://..." }
```

---

## 🚀 Deployment

### Local Testing
```bash
# Test RSS fallback (will activate if Tavily fails)
./scripts/fetch-news.sh

# Test manual URL input
./scripts/fetch-from-url.sh "https://www.cnn.com/latest"
```

### Production Deployment
```bash
# Deploy with message
./scripts/deploy.sh -m "Add RSS fallback and manual URL input for Tavily alternatives"

# Or quick deploy
./scripts/deploy.sh -s
```

**No `.env` changes needed** - Everything works with existing configuration!

---

## 📊 Backward Compatibility

✅ **100% backward compatible**

- Existing code continues to work
- RSS fallback is automatic
- No breaking changes
- No new dependencies needed

---

## 🧪 Testing Checklist

### On Production
```bash
# 1. Test RSS fallback (should work automatically)
ssh reels.hurated.com "docker compose -f prompt-reels/compose.yml logs -f" | grep -i rss

# 2. Test manual URL endpoint
curl -X POST https://reels.hurated.com/api/fetch-from-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.cnn.com"}'

# 3. Test fetch-from-url script
./scripts/fetch-from-url.sh "https://www.nbcnews.com/news"

# 4. Verify article workflow still works
./scripts/list.sh articles
```

---

## 🔍 Monitoring

### Check which source is used
```bash
# Watch logs for fallback activation
docker compose logs -f | grep "Tavily\|RSS\|fallback"

# Expected output when Tavily fails:
# "Tavily failed: Request failed with status code 432"
# "⚡ Falling back to RSS feeds (free, no API needed)..."
# "RSS feeds returned 47 articles"
# "✓ Success! Found video after checking 12 articles (source: RSS feeds)"
```

### Check article sources
```bash
# See where articles came from
cat output/articles/article-*.json | jq '.source.domain' | sort | uniq -c
```

---

## 💾 What Gets Logged

### RSS Fallback Activated
```
Tavily failed: Request failed with status code 432
⚡ Falling back to RSS feeds (free, no API needed)...
Fetching articles from 13 RSS feeds...
✓ cnn.com: 25 articles
✓ nbcnews.com: 30 articles
✓ bbc.co.uk: 18 articles
RSS feeds returned 50 articles
```

### Manual URL Input
```
Fetching article from manual URL: https://www.cnn.com/article
Found video: https://cdn.cnn.com/video/123.mp4
Video downloaded: uploads/articles/article-123.mp4
✓ Success! Article fetched from manual URL
```

---

## 🐛 Known Issues

### BrowserBase Still Required
**RSS feeds don't eliminate BrowserBase** - you still need it for video extraction.

If BrowserBase is also rate-limited:
- Wait for quota reset
- Use existing articles: `./scripts/list.sh articles`
- Contact BrowserBase support for higher limits

### Video Extraction Success Rate
RSS feeds may have **lower video extraction rate** than Tavily because:
- RSS gives less context about video content
- Some articles may not have videos
- Solution: Check more articles (already fetches 50 vs Tavily's 3-96)

---

## 📈 Performance Impact

| Metric | Before (Tavily only) | After (with RSS fallback) |
|--------|---------------------|---------------------------|
| **Articles checked** | 3-96 | Up to 50 from RSS |
| **API dependencies** | Tavily + BrowserBase | Tavily → RSS (free) + BrowserBase |
| **Failure mode** | Complete failure | Graceful fallback |
| **Cost** | Tavily quota | RSS = free |

---

## 🎯 Recommended Usage

### When Tavily is working
```bash
# Use normal workflow
./scripts/fetch-news.sh  # Uses Tavily with RSS fallback
```

### When Tavily is down (HTTP 432)
```bash
# Automatic fallback kicks in
./scripts/fetch-news.sh  # Automatically uses RSS

# Or provide specific URLs
./scripts/fetch-from-url.sh "https://www.cnn.com/video-article"
./scripts/fetch-from-url.sh "https://www.nbcnews.com/video"
```

### For testing/demos
```bash
# Manual URLs are most reliable
./scripts/fetch-from-url.sh "https://known-video-article-url"
```

---

## 📚 Documentation

- **TAVILY_ALTERNATIVES.md** - Complete guide with examples
- **README.md** - Updated with new endpoints (update separately)
- **TODO.md** - Mark RSS fallback as completed (update separately)

---

## 🔄 Rollback Plan

If issues occur:

```bash
# Revert changes
git revert HEAD
./scripts/deploy.sh -m "Revert RSS fallback changes"

# Or disable RSS fallback without revert:
# In src/core/newsFetcher.js, change:
# const articleData = await fetchNewsArticle(query);
# to:
# const articleData = await fetchNewsArticle(query, 3, false); // false = disable RSS
```

---

## ✅ Deployment Checklist

- [ ] Test locally with `./scripts/fetch-from-url.sh`
- [ ] Commit changes: `git add -A && git commit -m "Add RSS fallback"`
- [ ] Deploy: `./scripts/deploy.sh -s`
- [ ] Test on production: `./scripts/fetch-from-url.sh "https://www.cnn.com"`
- [ ] Monitor logs: `docker compose logs -f | grep RSS`
- [ ] Update README.md with new endpoints
- [ ] Update TODO.md to mark features complete
- [ ] Verify existing articles still work: `./scripts/list.sh articles`

---

## 📞 Support

If you encounter issues:
1. Check logs: `docker compose logs -f`
2. Read TAVILY_ALTERNATIVES.md
3. Test RSS directly: `node -e "require('./src/core/rssFetcher').fetchFromRSSFeeds(5).then(console.log)"`
4. Open GitHub issue with error logs
