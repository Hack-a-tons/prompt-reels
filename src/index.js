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
      console.log(`\nHealth check: http://localhost:${config.port}/health`);
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
