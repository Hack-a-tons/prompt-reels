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
                            <a href="/api/articles/${article.articleId}" target="_blank">${article.title}</a>
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
