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
        h1 { margin-bottom: 30px; font-size: 32px; }
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
        a { color: #1d9bf0; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .title { max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
            color: #10b981;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📰 Prompt Reels - Article Dashboard</h1>
        
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
                ${articles.map(article => `
                <tr>
                    <td>
                        <div class="title">
                            <a href="/articles/${article.articleId}">${article.title}</a>
                        </div>
                    </td>
                    <td>${article.source}</td>
                    <td><span class="status status-${article.status}">${article.status}</span></td>
                    <td>
                        <span class="video-badge ${article.hasLocalVideo ? 'local' : ''}">${article.videoType}</span>
                        ${article.hasLocalVideo ? ' ✓' : ''}
                    </td>
                    <td>${article.sceneCount || '-'}</td>
                    <td>${article.matchScore ? `<span class="score">${article.matchScore}</span>` : '-'}</td>
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
                `).join('')}
            </tbody>
        </table>
        `}
    </div>
    
    <script>
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
  
  const videoUrl = article.video.localPath 
    ? `/${article.video.localPath}`
    : article.video.url;
  
  const hasLocalVideo = !!article.video.localPath;
  
  // Simple text formatter (handles newlines and basic formatting)
  const formatText = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^(.+)$/, '<p>$1</p>');
  };
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} - Prompt Reels</title>
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
            </div>
        </div>
        
        ${hasLocalVideo ? `
        <div class="video-container">
            <video controls autoplay muted playsinline>
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
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
            <div class="description">${formatText(article.description)}</div>
        </div>
        ` : ''}
        
        ${article.text && article.text !== article.description ? `
        <div class="content-section">
            <h2>Full Article Text</h2>
            <div class="description">${formatText(article.text.substring(0, 2000))}${article.text.length > 2000 ? '...' : ''}</div>
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
                    <button class="btn" onclick="rateArticle()">Rate Match</button>
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
            
            try {
                const res = await fetch('/api/articles/${article.articleId}/rate', { method: 'POST' });
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
    </script>
</body>
</html>
  `;
  
  res.send(html);
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize Weave and start server
let server;

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
