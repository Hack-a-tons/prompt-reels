require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 15000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // AI Provider: 'azure' or 'gemini'
  aiProvider: process.env.AI_PROVIDER || 'azure',

  // Google Gemini
  googleApiKey: process.env.GOOGLE_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-pro',

  // Weights & Biases (Weave)
  wandbApiKey: process.env.WANDB_API_KEY,
  wandbProject: process.env.WANDB_PROJECT || 'prompt-reels',

  // Azure OpenAI
  azureOpenAI: {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_API_VERSION || '2025-01-01-preview',
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4.1',
  },

  // Directories
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  outputDir: process.env.OUTPUT_DIR || './output',
  dataDir: process.env.DATA_DIR || './data',

  // News Fetching APIs
  tavilyApiKey: process.env.TAVILY_API_KEY,
  browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
  browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
};

// Validate required config
const validateConfig = () => {
  const errors = [];

  if (config.aiProvider === 'azure' && !config.azureOpenAI.apiKey) {
    errors.push('AI_PROVIDER is set to azure but AZURE_OPENAI_API_KEY is not configured');
  }
  
  if (config.aiProvider === 'gemini' && !config.googleApiKey) {
    errors.push('AI_PROVIDER is set to gemini but GOOGLE_API_KEY is not configured');
  }

  if (!config.googleApiKey && !config.azureOpenAI.apiKey) {
    errors.push('Either GOOGLE_API_KEY or AZURE_OPENAI_API_KEY must be set');
  }

  if (!config.wandbApiKey) {
    errors.push('WANDB_API_KEY is required for Weave logging');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
};

validateConfig();

module.exports = config;
