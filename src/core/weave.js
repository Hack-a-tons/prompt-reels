const config = require('../config');
const fs = require('fs');
const path = require('path');

let weaveClient = null;
let logFile = null;

/**
 * Initialize Weave for experiment tracking
 * Using file-based logging until official Weave SDK is integrated
 */
const initWeave = async () => {
  try {
    // Create logs directory
    const logsDir = path.join(config.outputDir, 'weave-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create log file for this session
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    logFile = path.join(logsDir, `weave-${timestamp}.jsonl`);
    
    // Log initialization
    const initLog = {
      type: 'init',
      project: config.wandbProject,
      timestamp: new Date().toISOString(),
      config: {
        model: config.geminiModel,
        hasGemini: !!config.googleApiKey,
        hasAzure: !!config.azureOpenAI.apiKey,
      },
    };
    
    fs.writeFileSync(logFile, JSON.stringify(initLog) + '\n');
    
    weaveClient = { initialized: true, logFile };
    console.log(`Weave logging initialized for project: ${config.wandbProject}`);
    console.log(`Logs will be written to: ${logFile}`);
    
    return weaveClient;
  } catch (error) {
    console.error('Failed to initialize Weave logging:', error);
    throw error;
  }
};

/**
 * Log a prompt evaluation to Weave
 */
const logPromptEvaluation = async (data) => {
  if (!weaveClient) {
    console.warn('Weave not initialized');
    return;
  }

  try {
    const log = {
      type: 'prompt_evaluation',
      timestamp: new Date().toISOString(),
      data,
    };
    
    fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
    console.log(`[Weave] Logged prompt evaluation: ${data.promptId} (${data.domain})`);
  } catch (error) {
    console.error('Failed to log prompt evaluation:', error);
  }
};

/**
 * Log FPO iteration results to Weave
 */
const logFPOIteration = async (data) => {
  if (!weaveClient) {
    console.warn('Weave not initialized');
    return;
  }

  try {
    const log = {
      type: 'fpo_iteration',
      timestamp: new Date().toISOString(),
      data,
    };
    
    fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
    console.log(`[Weave] Logged FPO iteration ${data.iteration}`);
  } catch (error) {
    console.error('Failed to log FPO iteration:', error);
  }
};

/**
 * Log video analysis results to Weave
 */
const logVideoAnalysis = async (data) => {
  if (!weaveClient) {
    console.warn('Weave not initialized');
    return;
  }

  try {
    const log = {
      type: 'video_analysis',
      timestamp: new Date().toISOString(),
      data,
    };
    
    fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
    console.log(`[Weave] Logged video analysis: ${data.videoId}`);
  } catch (error) {
    console.error('Failed to log video analysis:', error);
  }
};

/**
 * Create a custom Weave metric
 */
const createMetric = (name, value, metadata = {}) => {
  return {
    name,
    value,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
};

module.exports = {
  initWeave,
  logPromptEvaluation,
  logFPOIteration,
  logVideoAnalysis,
  createMetric,
  getWeaveClient: () => weaveClient,
};
