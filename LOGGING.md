# API Logging

All API requests and responses are logged with timestamp, IP address, request details, and response status.

## Log Format

```
[icon] YYYY-MM-DD HH:MM:SS IP_ADDRESS      METHOD PATH BODY → STATUS TIME RESPONSE
```

Maximum line length: **140 columns**

## Icons

- ✓  Success (2xx responses)
- ↪️  Redirect (3xx responses)
- ⚠️  Client error (4xx responses)
- ❌ Server error (5xx responses)

## Examples

### Upload Video
```
✓  2025-01-12 10:30:15 192.168.1.100   POST /api/upload  → 200   45ms vid=video-1736683815
```

### Fetch News Article
```
✓  2025-01-12 10:31:42 192.168.1.100   POST /api/fetch-news {"query":"tech news"} → 200 2341ms aid=article-1736683902-123
```

### List Articles
```
✓  2025-01-12 10:32:05 192.168.1.100   GET  /api/articles  → 200   12ms cnt=5
```

### Detect Scenes
```
✓  2025-01-12 10:32:30 192.168.1.100   POST /api/detect-scenes {"videoId":"video-17..."} → 200  891ms ok=true vid=video-1736683...
```

### Error Response
```
⚠️  2025-01-12 10:33:15 192.168.1.100   POST /api/analyze {"videoId":"invalid"} → 404   3ms err="Video not found"
```

### Server Error
```
❌ 2025-01-12 10:34:01 192.168.1.100   POST /api/fetch-news  → 500  15ms err="TAVILY_API_KEY not con..."
```

## Features

- **Timestamp**: ISO format (YYYY-MM-DD HH:MM:SS)
- **IP Address**: Extracts real IP from X-Forwarded-For, X-Real-IP, or socket
- **Request**: Method, path, and sanitized body (passwords/tokens hidden)
- **Response**: Status code, duration (ms), and key fields
- **Truncation**: Long values truncated with "..." to keep line ≤140 chars
- **Color Coded**: Different icons for different status codes

## Excluded from Logs

- `/health` endpoint (too noisy)
- Static file requests `/uploads/*`, `/output/*`

## Manual Logging

Use the logger utility in your code:

```javascript
const { log } = require('./utils/logger');

log.info('Processing video...');
log.error('Failed to process video');
log.warn('API key missing');
log.debug('Debug info'); // Only in development
```

## IP Address Detection

The logger detects client IP from:
1. `X-Forwarded-For` header (first IP in chain)
2. `X-Real-IP` header
3. `req.socket.remoteAddress`
4. `req.ip`
5. Falls back to 'unknown'

This works correctly behind proxies (nginx, load balancers).
