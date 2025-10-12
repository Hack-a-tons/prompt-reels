const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('./config');
const routes = require('./api/routes');
const { initWeave } = require('./core/weave');
const { logMiddleware } = require('./utils/logger');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware (logs all API calls with timestamp, IP, request/response)
app.use(logMiddleware);

// Serve static files (videos and extracted frames)
app.use('/uploads', express.static(path.join(__dirname, '..', config.uploadDir)));
app.use('/output', express.static(path.join(__dirname, '..', config.outputDir)));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'prompt-reels',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      geminiModel: config.geminiModel,
      wandbProject: config.wandbProject,
      hasGeminiKey: !!config.googleApiKey,
      hasAzureKey: !!config.azureOpenAI.apiKey,
      hasWandbKey: !!config.wandbApiKey,
    },
  });
});

// API routes
app.use('/api', routes);

// Dashboard HTML page
app.get('/', (req, res) => {
  const { listArticles } = require('./core/articleWorkflow');
  const articles = listArticles();
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Reels - Article Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419;
            color: #e7e9ea;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }
        h1 { font-size: 32px; margin: 0; }
        .add-articles-btn {
            background: #1d9bf0;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 9999px;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }
        .add-articles-btn:hover:not(:disabled) {
            background: #1a8cd8;
        }
        .add-articles-btn:disabled {
            background: #2f3336;
            color: #71767b;
            cursor: not-allowed;
        }
        .add-articles-btn .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 20px;
        }
        .stat-number { font-size: 32px; font-weight: bold; color: #1d9bf0; }
        .stat-label { color: #71767b; margin-top: 5px; }
        table {
            width: 100%;
            border-collapse: collapse;
            background: #16181c;
            border-radius: 12px;
            overflow: hidden;
        }
        th, td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #2f3336;
        }
        .video-preview {
            width: 160px;
            height: 90px;
            border-radius: 6px;
            background: #0f1419;
        }
        .no-video {
            width: 160px;
            height: 90px;
            background: #2f3336;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #71767b;
            font-size: 12px;
        }
        th { background: #1c1f23; color: #71767b; font-weight: 600; font-size: 13px; text-transform: uppercase; }
        tr:hover { background: #1c1f23; }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .status-fetched { background: #1d4ed8; color: #dbeafe; }
        .status-described { background: #7c3aed; color: #ede9fe; }
        .status-rated { background: #059669; color: #d1fae5; }
        .status-error { background: #dc2626; color: #fee2e2; }
        .video-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            background: #2f3336;
            color: #71767b;
        }
        .video-badge.local { background: #15803d; color: #d1fae5; }
        .title {
            font-size: 16px;
            font-weight: 500;
            max-width: 400px;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .title a { color: #e7e9ea; text-decoration: none; }
        .title a:hover { color: #1d9bf0; text-decoration: underline; }
        .actions { display: flex; gap: 10px; }
        .btn {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            border: 1px solid #2f3336;
            background: #16181c;
            color: #e7e9ea;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover { background: #1c1f23; border-color: #1d9bf0; }
        .empty {
            text-align: center;
            padding: 60px 20px;
            color: #71767b;
        }
        .score {
            font-weight: bold;
        }
        .score.high { color: #10b981; }
        .score.medium { color: #f59e0b; }
        .score.low { color: #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Prompt Reels - Article Dashboard</h1>
            <div style="display: flex; gap: 15px; align-items: center;">
                <a href="/prompts" class="add-articles-btn" style="text-decoration: none; background: #2f3336;">🧠 View Prompts</a>
                <button id="addArticlesBtn" class="add-articles-btn" onclick="addArticles()" style="display: none;">
                    + Add 10 Articles
                </button>
                <span id="addingStatus" style="display: none; color: #71767b; font-size: 14px;">
                    <span class="spinner" style="width: 14px; height: 14px;"></span> Adding articles...
                </span>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${articles.length}</div>
                <div class="stat-label">Total Articles</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${articles.filter(a => a.status === 'fetched').length}</div>
                <div class="stat-label">Fetched</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${articles.filter(a => a.status === 'described').length}</div>
                <div class="stat-label">Described</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${articles.filter(a => a.status === 'rated').length}</div>
                <div class="stat-label">Rated</div>
            </div>
        </div>
        
        ${articles.length === 0 ? `
        <div class="empty">
            <h2>No articles yet</h2>
            <p>Fetch your first article with:</p>
            <p><code>./scripts/fetch-news.sh</code></p>
        </div>
        ` : `
        <table>
            <thead>
                <tr>
                    <th>Preview</th>
                    <th>Article</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Video</th>
                    <th>Scenes</th>
                    <th>Score</th>
                    <th>Fetched</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${articles.map(article => {
                    // Get video player for preview
                    let videoHtml = '<div class="no-video">No video</div>';
                    if (article.hasLocalVideo) {
                        const videoPath = `/api/articles/${article.articleId}.mp4`;
                        videoHtml = `<video class="video-preview" autoplay muted loop playsinline preload="metadata"><source src="${videoPath}" type="video/mp4"></video>`;
                    }
                    
                    // Score coloring: high (>70) = green, medium (40-70) = yellow, low (<40) = red
                    let scoreClass = 'high';
                    if (article.matchScore) {
                        if (article.matchScore < 40) scoreClass = 'low';
                        else if (article.matchScore < 70) scoreClass = 'medium';
                    }
                    
                    return `
                <tr>
                    <td>${videoHtml}</td>
                    <td>
                        <div class="title">
                            <a href="/articles/${article.articleId}">${article.title}</a>
                        </div>
                    </td>
                    <td>${article.source.domain}</td>
                    <td><span class="status status-${article.status}">${article.status}</span></td>
                    <td>
                        <span class="video-badge ${article.hasLocalVideo ? 'local' : ''}">${article.videoType}</span>
                        ${article.hasLocalVideo ? ' ✓' : ''}
                    </td>
                    <td>${article.sceneCount || '-'}</td>
                    <td>${article.matchScore ? `<span class="score ${scoreClass}">${article.matchScore}</span>` : '-'}</td>
                    <td>${new Date(article.fetchedAt).toLocaleString()}</td>
                    <td class="actions">
                        ${article.status === 'fetched' && article.hasLocalVideo ? 
                            `<button class="btn" onclick="describeArticle('${article.articleId}')">Describe</button>` : ''}
                        ${article.status === 'described' ? 
                            `<a href="/api/scenes/${article.articleId}" class="btn" target="_blank">View Scenes</a>
                             <button class="btn" onclick="rateArticle('${article.articleId}')">Rate</button>` : ''}
                        ${article.status === 'rated' ? 
                            `<a href="/api/scenes/${article.articleId}" class="btn" target="_blank">View Scenes</a>` : ''}
                    </td>
                </tr>
                `;
                }).join('')}
            </tbody>
        </table>
        `}
    </div>
    
    <script>
        // Check flag status and update UI
        async function checkFlagStatus() {
            try {
                const res = await fetch('/api/flags/status');
                const data = await res.json();
                
                const btn = document.getElementById('addArticlesBtn');
                const status = document.getElementById('addingStatus');
                
                if (data.batchAdding) {
                    btn.style.display = 'none';
                    status.style.display = 'flex';
                } else {
                    btn.style.display = 'inline-block';
                    status.style.display = 'none';
                }
            } catch (err) {
                console.error('Error checking flags:', err);
            }
        }
        
        // Check on page load
        checkFlagStatus();
        
        // Check every 3 seconds
        setInterval(checkFlagStatus, 3000);
        
        async function describeArticle(articleId) {
            if (!confirm('Describe scenes for this article? This may take a few minutes.')) return;
            
            try {
                const res = await fetch(\`/api/articles/\${articleId}/describe\`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(\`Success! Found \${data.sceneCount} scenes.\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
        
        async function rateArticle(articleId) {
            if (!confirm('Rate video-article match? This uses AI to analyze.')) return;
            
            try {
                const res = await fetch(\`/api/articles/\${articleId}/rate\`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(\`Rated: \${data.matchScore}/100\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
        
        let isAddingArticles = false;
        
        async function addArticles() {
            if (isAddingArticles) {
                alert('Already adding articles, please wait...');
                return;
            }
            
            const btn = document.getElementById('addArticlesBtn');
            const status = document.getElementById('addingStatus');
            
            // Hide button immediately
            btn.style.display = 'none';
            status.style.display = 'flex';
            
            isAddingArticles = true;
            
            // Auto-refresh every 3 seconds to show progress
            const refreshInterval = setInterval(() => {
                const currentCount = document.querySelectorAll('tbody tr').length;
                fetch('/api/dashboard')
                    .then(r => r.json())
                    .then(d => {
                        if (d.count > currentCount) {
                            location.reload();
                        }
                    });
            }, 3000);
            
            try {
                const res = await fetch('/api/articles/batch-add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: 10 })
                });
                
                clearInterval(refreshInterval);
                const data = await res.json();
                
                if (data.success) {
                    alert(\`Success! Added \${data.added} new articles (checked \${data.attempts} total)\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                    // Show button again on error
                    btn.style.display = 'inline-block';
                    status.style.display = 'none';
                    isAddingArticles = false;
                }
            } catch (err) {
                clearInterval(refreshInterval);
                // Don't show error if it's just a timeout - articles are still being added
                console.log('Batch add in progress, page will auto-refresh...');
                // Keep button disabled and keep refreshing
            }
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// Article detail HTML page
app.get('/articles/:articleId', (req, res) => {
  const { getArticleDetails } = require('./core/articleWorkflow');
  const { articleId } = req.params;
  const article = getArticleDetails(articleId);
  
  if (!article) {
    return res.status(404).send('<h1>Article not found</h1>');
  }
  
  // Use streaming endpoint for local videos (supports range requests)
  const videoUrl = article.video.localPath 
    ? `/api/articles/${articleId}.mp4`
    : article.video.url;
  
  const hasLocalVideo = !!article.video.localPath;
  
  // Escape HTML for safe inclusion in JavaScript string
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  };
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} - Prompt Reels</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419;
            color: #e7e9ea;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .back-link {
            display: inline-block;
            color: #1d9bf0;
            text-decoration: none;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .back-link:hover { text-decoration: underline; }
        .article-header {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        .status-fetched { background: #1d4ed8; color: #dbeafe; }
        .status-described { background: #7c3aed; color: #ede9fe; }
        .status-rated { background: #059669; color: #d1fae5; }
        h1 { font-size: 32px; margin-bottom: 15px; }
        .meta {
            display: flex;
            gap: 20px;
            color: #71767b;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .video-container {
            background: #000;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 20px;
            position: relative;
        }
        video {
            width: 100%;
            max-height: 600px;
            display: block;
        }
        .no-video {
            padding: 60px;
            text-align: center;
            background: #16181c;
            border: 2px dashed #2f3336;
            border-radius: 12px;
            color: #71767b;
        }
        .content-section {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
        }
        .content-section h2 {
            font-size: 20px;
            margin-bottom: 15px;
            color: #1d9bf0;
        }
        .description {
            color: #e7e9ea;
            line-height: 1.8;
        }
        .description h1 {
            font-size: 28px;
            margin: 25px 0 15px 0;
            color: #e7e9ea;
        }
        .description h2 {
            font-size: 22px;
            margin: 20px 0 12px 0;
            color: #1d9bf0;
        }
        .description h3 {
            font-size: 18px;
            margin: 18px 0 10px 0;
            color: #71767b;
            font-weight: 600;
        }
        .description p {
            margin-bottom: 15px;
        }
        .description ul, .description ol {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .description li {
            margin-bottom: 8px;
        }
        .description code {
            background: #1c1f23;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        .description strong {
            color: #1d9bf0;
            font-weight: 600;
        }
        .description a {
            color: #1d9bf0;
            text-decoration: none;
        }
        .description a:hover {
            text-decoration: underline;
        }
        .video-link {
            display: block;
            margin-top: 10px;
            color: #71767b;
            font-size: 14px;
            text-decoration: none;
        }
        .video-link:hover {
            color: #1d9bf0;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .info-card {
            background: #1c1f23;
            padding: 15px;
            border-radius: 8px;
        }
        .info-label {
            color: #71767b;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .info-value {
            color: #e7e9ea;
            font-size: 16px;
            font-weight: 600;
        }
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        .btn {
            padding: 10px 20px;
            border-radius: 8px;
            border: 1px solid #2f3336;
            background: #1d9bf0;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover { background: #1a8cd8; }
        .btn-secondary {
            background: #16181c;
            color: #e7e9ea;
        }
        .btn-secondary:hover { background: #1c1f23; border-color: #1d9bf0; }
        .scenes-link {
            color: #1d9bf0;
            text-decoration: none;
            font-weight: 600;
        }
        .scenes-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-link">← Back to Dashboard</a>
        
        <div class="article-header">
            <span class="status-badge status-${article.workflow.status}">${article.workflow.status}</span>
            <h1>${article.title}</h1>
            <div class="meta">
                <span>📰 ${article.source.domain}</span>
                <span>📅 ${new Date(article.fetchedAt).toLocaleString()}</span>
                ${article.workflow.matchScore ? `<span>⭐ Score: ${article.workflow.matchScore}/100</span>` : ''}
                ${article.workflow.sceneCount ? `<span><a href="/api/scenes/${article.articleId}" style="color: #1d9bf0; text-decoration: none;">🎬 View ${article.workflow.sceneCount} Scene${article.workflow.sceneCount > 1 ? 's' : ''}</a></span>` : ''}
            </div>
        </div>
        
        ${hasLocalVideo ? `
        <div class="video-container">
            <video controls autoplay muted playsinline preload="metadata">
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
        <a href="${videoUrl}" class="video-link" target="_blank">🔗 Direct video link: ${videoUrl}</a>
        ` : `
        <div class="no-video">
            <h2>📹 Video Not Downloaded</h2>
            <p>This article has an embedded video that wasn't downloaded.</p>
            <p style="margin-top: 10px; color: #71767b;">Type: ${article.video.type} | Platform: ${article.video.platform || 'N/A'}</p>
            ${article.video.url ? `<p style="margin-top: 10px;"><a href="${article.video.url}" target="_blank" style="color: #1d9bf0;">View original video</a></p>` : ''}
        </div>
        `}
        
        <div class="info-grid">
            <div class="info-card">
                <div class="info-label">Status</div>
                <div class="info-value">${article.workflow.status}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Video Type</div>
                <div class="info-value">${article.video.type}</div>
            </div>
            ${article.workflow.sceneCount ? `
            <div class="info-card">
                <div class="info-label">Scenes</div>
                <div class="info-value">${article.workflow.sceneCount}</div>
            </div>
            ` : ''}
            ${article.workflow.matchScore ? `
            <div class="info-card">
                <div class="info-label">Match Score</div>
                <div class="info-value">${article.workflow.matchScore}/100</div>
            </div>
            ` : ''}
        </div>
        
        ${article.description ? `
        <div class="content-section">
            <h2>Description</h2>
            <div class="description" id="description-content"></div>
        </div>
        ` : ''}
        
        ${article.text && article.text !== article.description ? `
        <div class="content-section">
            <h2>Full Article Text</h2>
            <div class="description" id="text-content"></div>
        </div>
        ` : ''}
        
        <div class="content-section">
            <h2>Actions</h2>
            <div class="actions">
                ${article.workflow.status === 'fetched' && hasLocalVideo ? `
                    <button class="btn" onclick="describeArticle()">Describe Scenes</button>
                ` : ''}
                ${article.workflow.status === 'described' ? `
                    <a href="/api/scenes/${article.articleId}" class="btn" target="_blank">View Scenes</a>
                    <button id="rateBtn" class="btn" onclick="rateArticle()">Rate Match</button>
                    <span id="ratingStatus" style="display: none; color: #71767b; font-size: 13px; margin-left: 10px;">
                        <span class="spinner" style="width: 12px; height: 12px;"></span> Rating...
                    </span>
                ` : ''}
                ${article.workflow.status === 'rated' ? `
                    <a href="/api/scenes/${article.articleId}" class="btn" target="_blank">View Scenes</a>
                ` : ''}
                <a href="${article.source.url}" class="btn btn-secondary" target="_blank">View Original Article</a>
                <a href="/api/articles/${article.articleId}" class="btn btn-secondary" target="_blank">View JSON</a>
            </div>
        </div>
        
        ${article.sceneData ? `
        <div class="content-section">
            <h2>Scene Analysis</h2>
            <p>This article has been analyzed. <a href="/api/scenes/${article.articleId}" class="scenes-link">View detailed scene descriptions →</a></p>
        </div>
        ` : ''}
    </div>
    
    <script>
        // Render markdown content
        const descriptionEl = document.getElementById('description-content');
        const textEl = document.getElementById('text-content');
        
        if (descriptionEl) {
            const description = '${escapeHtml(article.description)}';
            descriptionEl.innerHTML = marked.parse(description);
        }
        
        if (textEl) {
            const text = '${escapeHtml(article.text.substring(0, 2000))}';
            textEl.innerHTML = marked.parse(text) + ${article.text.length > 2000 ? '"..."' : '""'};
        }
        
        // Check if rating is in progress (for described articles)
        const rateBtn = document.getElementById('rateBtn');
        const ratingStatus = document.getElementById('ratingStatus');
        
        if (rateBtn && ratingStatus) {
            async function checkRatingStatus() {
                try {
                    const res = await fetch('/api/flags/status');
                    const data = await res.json();
                    
                    // Check if this specific article is being rated
                    const isRating = data.batchAddingData || false; // Simplified check
                    
                    if (isRating) {
                        rateBtn.style.display = 'none';
                        ratingStatus.style.display = 'inline-flex';
                    } else {
                        rateBtn.style.display = 'inline-block';
                        ratingStatus.style.display = 'none';
                    }
                } catch (err) {
                    console.error('Error checking rating status:', err);
                }
            }
            
            checkRatingStatus();
            setInterval(checkRatingStatus, 3000);
        }
        
        async function describeArticle() {
            if (!confirm('Describe scenes for this article? This may take a few minutes.')) return;
            
            try {
                const res = await fetch('/api/articles/${article.articleId}/describe', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(\`Success! Found \${data.sceneCount} scenes.\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
        
        async function rateArticle() {
            if (!confirm('Rate video-article match? This uses AI to analyze.')) return;
            
            // Hide button immediately
            const rateBtn = document.getElementById('rateBtn');
            const ratingStatus = document.getElementById('ratingStatus');
            if (rateBtn && ratingStatus) {
                rateBtn.style.display = 'none';
                ratingStatus.style.display = 'inline-flex';
            }
            
            try {
                const res = await fetch('/api/articles/${article.articleId}/rate', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(\`Rated: \${data.matchScore}/100\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                    // Show button again on error
                    if (rateBtn && ratingStatus) {
                        rateBtn.style.display = 'inline-block';
                        ratingStatus.style.display = 'none';
                    }
                }
            } catch (err) {
                alert('Error: ' + err.message);
                // Show button again on error
                if (rateBtn && ratingStatus) {
                    rateBtn.style.display = 'inline-block';
                    ratingStatus.style.display = 'none';
                }
            }
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// Prompts viewer page
app.get('/prompts', (req, res) => {
  const { loadPrompts } = require('./core/promptOptimizer');
  
  try {
    const prompts = loadPrompts();
    
    // Handle old format: prompts.templates array
    // Convert to versions format for display
    const templates = prompts.templates || [];
    
    // Group templates into two categories for display
    const sceneVersions = templates.map((t, index) => ({
      version: `1.${index}`,
      name: t.name,
      template: t.template,
      performance: {
        avgScore: t.performance && t.performance.length > 0 
          ? t.performance.reduce((sum, p) => sum + p.score, 0) / t.performance.length 
          : null,
        samples: t.performance ? t.performance.length : 0
      },
      createdAt: new Date().toISOString(),
      isActive: index === 0
    }));
    
    // Sort: tested first (by score), then untested
    const testedVersions = sceneVersions.filter(v => v.performance.samples > 0)
      .sort((a, b) => (b.performance.avgScore || 0) - (a.performance.avgScore || 0));
    const untestedVersions = sceneVersions.filter(v => v.performance.samples === 0);
    
    const matchVersions = []; // Not yet implemented in this JSON structure
    
    // Combine tested and untested
    const sortedSceneVersions = [...testedVersions, ...untestedVersions];
    
    const sortedMatchVersions = matchVersions;
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Optimization History - Prompt Reels</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419;
            color: #e7e9ea;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }
        h1 { font-size: 32px; }
        .back-link {
            color: #1d9bf0;
            text-decoration: none;
            font-size: 16px;
        }
        .back-link:hover { text-decoration: underline; }
        
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            border-bottom: 1px solid #2f3336;
        }
        .tab {
            padding: 15px 25px;
            cursor: pointer;
            background: transparent;
            border: none;
            color: #71767b;
            font-size: 16px;
            font-weight: 500;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
        }
        .tab:hover { color: #e7e9ea; }
        .tab.active {
            color: #1d9bf0;
            border-bottom-color: #1d9bf0;
        }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        .prompt-card {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            position: relative;
        }
        .prompt-card.best {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.05);
        }
        .prompt-card.current {
            border-color: #1d9bf0;
        }
        
        .badge {
            position: absolute;
            top: 15px;
            right: 15px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge.best {
            background: #10b981;
            color: white;
        }
        .badge.current {
            background: #1d9bf0;
            color: white;
        }
        
        .prompt-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 15px;
        }
        .prompt-version {
            font-size: 24px;
            font-weight: bold;
            color: #e7e9ea;
        }
        .prompt-score {
            font-size: 32px;
            font-weight: bold;
            color: #10b981;
        }
        .prompt-score.low { color: #f59e0b; }
        .prompt-score.poor { color: #ef4444; }
        
        .prompt-stats {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            font-size: 14px;
            color: #71767b;
        }
        .stat {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .prompt-text {
            background: #0f1419;
            border: 1px solid #2f3336;
            border-radius: 8px;
            padding: 15px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            color: #e7e9ea;
        }
        
        .improvement {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            margin-left: 10px;
            font-size: 14px;
            font-weight: 600;
        }
        .improvement.positive { color: #10b981; }
        .improvement.negative { color: #ef4444; }
        
        .info-box {
            background: rgba(29, 155, 240, 0.1);
            border: 1px solid rgba(29, 155, 240, 0.3);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .info-box h3 {
            color: #1d9bf0;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .info-box p {
            color: #e7e9ea;
            line-height: 1.6;
        }
        
        .empty {
            text-align: center;
            padding: 60px 20px;
            color: #71767b;
        }
        .empty h2 {
            font-size: 24px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h1>🧠 Prompt Optimization History</h1>
                <a href="/" class="back-link" style="position: static; margin-top: 10px; display: inline-block;">← Back to Dashboard</a>
            </div>
            <div style="display: flex; gap: 15px; align-items: center;">
                <button id="runFpoBtn" class="add-articles-btn" onclick="runFPO()" style="background: #7c3aed;">
                    🚀 Run FPO Iteration
                </button>
                <span id="fpoStatus" style="display: none; color: #71767b; font-size: 14px;">
                    <span class="spinner" style="width: 14px; height: 14px;"></span> Running FPO...
                </span>
            </div>
        </div>
        
        <div class="info-box">
            <h3>How Prompt Ranking Works</h3>
            <p><strong>Score = Semantic Similarity</strong> between AI output and ground truth (0-1 scale, shown as 0-100).</p>
            <p style="margin-top: 10px;">
                <strong>Scene Description:</strong> We compare AI-generated scene descriptions to article text using cosine similarity of embeddings. Higher scores mean the AI describes scenes more accurately.<br>
                <strong>Video-Article Match:</strong> We evaluate how well the AI rates video-article relevance. Scores reflect consistency and accuracy of match ratings.
            </p>
            <p style="margin-top: 10px;">
                Prompts are sorted <strong>best to worst</strong> based on average performance across multiple samples. Improvement percentages show gains over the baseline (first version).
            </p>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="switchTab('scene')">
                🎬 Scene Description (${sortedSceneVersions.length} versions)
            </button>
            <button class="tab" onclick="switchTab('match')">
                ⭐ Video-Article Match (${sortedMatchVersions.length} versions)
            </button>
        </div>
        
        <div id="scene-tab" class="tab-content active">
            ${sortedSceneVersions.length === 0 ? `
                <div class="empty">
                    <h2>No Optimized Prompts Yet</h2>
                    <p>Process some articles to start FPO optimization.</p>
                </div>
            ` : sortedSceneVersions.map((version, index) => {
                const isBest = index === 0 && version.performance.samples > 0;
                const isCurrent = version.isActive;
                const score = version.performance.avgScore;
                const samples = version.performance.samples || 0;
                const scoreClass = score === null ? 'poor' : (score >= 0.8 ? '' : score >= 0.6 ? 'low' : 'poor');
                const isTested = samples > 0;
                
                // Calculate improvement from baseline (only for tested prompts)
                let improvement = 0;
                let improvementText = '';
                let improvementClass = '';
                if (isTested && testedVersions.length > 1) {
                  const baseline = testedVersions[testedVersions.length - 1];
                  improvement = baseline ? ((score - baseline.performance.avgScore) / baseline.performance.avgScore * 100) : 0;
                  improvementText = improvement > 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`;
                  improvementClass = improvement > 0 ? 'positive' : 'negative';
                }
                
                return `
                <div class="prompt-card ${isBest ? 'best' : ''} ${isCurrent ? 'current' : ''} ${!isTested ? 'untested' : ''}">
                    ${isBest ? '<span class="badge best">🏆 BEST</span>' : ''}
                    ${!isTested ? '<span class="badge" style="background: #71767b;">NOT TESTED</span>' : ''}
                    ${isCurrent && !isBest && isTested ? '<span class="badge current">CURRENT</span>' : ''}
                    
                    <div class="prompt-header">
                        <div>
                            <div class="prompt-version">${version.name || 'Version ' + version.version}</div>
                            ${improvementText ? `<span class="improvement ${improvementClass}">${improvementText} from baseline</span>` : ''}
                        </div>
                        <div class="prompt-score ${scoreClass}">${isTested ? (score * 100).toFixed(1) : '—'}</div>
                    </div>
                    
                    <div class="prompt-stats">
                        <div class="stat">📊 ${samples} samples</div>
                        ${isTested ? `<div class="stat">Rank: #${testedVersions.indexOf(version) + 1}</div>` : '<div class="stat" style="color: #71767b;">Awaiting test</div>'}
                    </div>
                    
                    <div class="prompt-text">${version.template}</div>
                </div>
                `;
            }).join('')}
        </div>
        
        <div id="match-tab" class="tab-content">
            ${sortedMatchVersions.length === 0 ? `
                <div class="empty">
                    <h2>No Optimized Prompts Yet</h2>
                    <p>Process and rate some articles to start FPO optimization.</p>
                </div>
            ` : sortedMatchVersions.map((version, index) => {
                const isBest = index === 0;
                const isCurrent = version.isActive;
                const score = version.performance.avgScore || 0;
                const samples = version.performance.samples || 0;
                const scoreClass = score >= 0.8 ? '' : score >= 0.6 ? 'low' : 'poor';
                
                // Calculate improvement from baseline
                const baseline = sortedMatchVersions[sortedMatchVersions.length - 1];
                const improvement = baseline ? ((score - baseline.performance.avgScore) / baseline.performance.avgScore * 100) : 0;
                const improvementText = improvement > 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`;
                const improvementClass = improvement > 0 ? 'positive' : 'negative';
                
                return `
                <div class="prompt-card ${isBest ? 'best' : ''} ${isCurrent ? 'current' : ''}">
                    ${isBest ? '<span class="badge best">🏆 BEST</span>' : ''}
                    ${isCurrent && !isBest ? '<span class="badge current">CURRENT</span>' : ''}
                    
                    <div class="prompt-header">
                        <div>
                            <div class="prompt-version">Version ${version.version}</div>
                            ${improvement !== 0 ? `<span class="improvement ${improvementClass}">${improvementText} from baseline</span>` : ''}
                        </div>
                        <div class="prompt-score ${scoreClass}">${(score * 100).toFixed(1)}</div>
                    </div>
                    
                    <div class="prompt-stats">
                        <div class="stat">📊 ${samples} samples</div>
                        <div class="stat">📅 ${new Date(version.createdAt).toLocaleString()}</div>
                        <div class="stat">Rank: #${index + 1}</div>
                    </div>
                    
                    <div class="prompt-text">${version.template}</div>
                </div>
                `;
            }).join('')}
        </div>
    </div>
    
    <script>
        function switchTab(tab) {
            // Update tab buttons
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tab + '-tab').classList.add('active');
        }
        
        async function runFPO() {
            if (!confirm('Run FPO iteration? This will evaluate all prompts on available test data.')) return;
            
            const btn = document.getElementById('runFpoBtn');
            const status = document.getElementById('fpoStatus');
            
            // Hide button immediately
            btn.style.display = 'none';
            status.style.display = 'flex';
            
            try {
                const res = await fetch('/api/fpo/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ iterations: 1 })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    alert(\`FPO Complete!\\n\\nIterations: \${data.iterations}\\nFinal Prompt: \${data.finalPrompt}\\nEvolved: \${data.evolved} new prompts\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                    btn.style.display = 'inline-block';
                    status.style.display = 'none';
                }
            } catch (err) {
                alert('Error: ' + err.message);
                btn.style.display = 'inline-block';
                status.style.display = 'none';
            }
        }
    </script>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Error loading prompts</h1><p>${error.message}</p>`);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  const { log } = require('./utils/logger');
  log.error(`${req.method} ${req.path} - ${err.message}`);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });
});


const startServer = async () => {
  const { log } = require('./utils/logger');
  
  try {
    // Initialize Weave logging
    await initWeave();
    log.info('Weave initialized');

    // Start server
    server = app.listen(config.port, () => {
      log.info(`Prompt Reels API running on port ${config.port}`);
      log.info(`Environment: ${config.nodeEnv}`);
      log.info(`Using Gemini model: ${config.geminiModel}`);
      log.info(`Weave project: ${config.wandbProject}`);
      log.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    const { log } = require('./utils/logger');
    log.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = () => {
  const { log } = require('./utils/logger');
  log.warn('Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      log.info('Server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      log.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGUSR2', shutdown); // nodemon restart signal

startServer();

module.exports = app;
