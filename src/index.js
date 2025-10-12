const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const routes = require('./api/routes');
const { initWeave } = require('./core/weave');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
  console.error('Error:', err);
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
  try {
    // Initialize Weave logging
    await initWeave();
    console.log('✓ Weave initialized');

    // Start server
    server = app.listen(config.port, () => {
      console.log(`✓ Prompt Reels API running on port ${config.port}`);
      console.log(`✓ Environment: ${config.nodeEnv}`);
      console.log(`✓ Using Gemini model: ${config.geminiModel}`);
      console.log(`✓ Weave project: ${config.wandbProject}`);
      console.log(`\nHealth check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = () => {
  console.log('\n⚠ Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('✓ Server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('⚠ Forced shutdown after timeout');
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
