const config = require('../config');
const fs = require('fs');
const path = require('path');
const wandb = require('@wandb/sdk');

let weaveClient = null;
let wandbRun = null;
let logFile = null;
let useCloudWeave = false;

/**
 * Initialize Weave for experiment tracking
 * Tries W&B cloud first, falls back to file-based logging
 */
const initWeave = async () => {
  try {
    // Try to initialize W&B cloud
    if (config.wandbApiKey) {
      try {
        await wandb.init({
          apiKey: config.wandbApiKey,
          project: config.wandbProject,
          config: {
            aiProvider: config.aiProvider,
            model: config.geminiModel,
            azureDeployment: config.azureOpenAI.deploymentName,
          },
        });
        wandbRun = wandb;
        useCloudWeave = true;
        weaveClient = { initialized: true, cloud: true };
        console.log(`✓ W&B initialized for project: ${config.wandbProject}`);
        console.log(`✓ View at: https://wandb.ai/${config.wandbProject}`);
        return weaveClient;
      } catch (cloudError) {
        console.warn('Failed to connect to W&B cloud, using file-based logging:', cloudError.message);
      }
    }
    
    // Fallback to file-based logging
    const logsDir = path.join(config.outputDir, 'weave-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    logFile = path.join(logsDir, `weave-${timestamp}.jsonl`);
    
    const initLog = {
      type: 'init',
      project: config.wandbProject,
      timestamp: new Date().toISOString(),
      config: {
        model: config.geminiModel,
        aiProvider: config.aiProvider,
        hasGemini: !!config.googleApiKey,
        hasAzure: !!config.azureOpenAI.apiKey,
      },
    };
    
    fs.writeFileSync(logFile, JSON.stringify(initLog) + '\n');
    
    useCloudWeave = false;
    weaveClient = { initialized: true, cloud: false, logFile };
    console.log(`Weave logging initialized for project: ${config.wandbProject}`);
    console.log(`Logs will be written to: ${logFile}`);
    
    return weaveClient;
  } catch (error) {
    console.error('Failed to initialize Weave:', error);
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
    if (useCloudWeave && wandbRun) {
      // Log to W&B cloud
      await wandbRun.log({
        prompt_evaluation: {
          domain: data.domain,
          promptId: data.promptId,
          score: data.score,
          latency: data.latency,
        },
      });
    } else {
      // Log to file
      const log = {
        type: 'prompt_evaluation',
        timestamp: new Date().toISOString(),
        data,
      };
      fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
    }
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
    if (useCloudWeave && wandbRun) {
      // Log to W&B cloud
      await wandbRun.log({
        fpo_iteration: data.iteration,
        global_prompt: data.globalPrompt,
        prompt_weights: data.prompts.reduce((acc, p) => {
          acc[p.id] = p.weight;
          return acc;
        }, {}),
      });
    } else {
      // Log to file
      const log = {
        type: 'fpo_iteration',
        timestamp: new Date().toISOString(),
        data,
      };
      fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
    }
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
    if (useCloudWeave && wandbRun) {
      // Log to W&B cloud
      await wandbRun.log({
        video_analysis: {
          videoId: data.videoId,
          frameCount: data.frameCount,
          duration: data.duration,
        },
      });
    } else {
      // Log to file
      const log = {
        type: 'video_analysis',
        timestamp: new Date().toISOString(),
        data,
      };
      fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
    }
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
