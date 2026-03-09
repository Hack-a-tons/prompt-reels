/**
 * Audio Transcription using Whisper (Azure OpenAI)
 * Extracts audio from video scenes and transcribes dialogue
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const FormData = require('form-data');
const axios = require('axios');
const config = require('../config');
const { log } = require('../utils/logger');

/**
 * Convert language names to ISO 639-1 codes for Whisper
 * @param {string} language - Language name (e.g., "English", "Russian", "Italian")
 * @returns {string|null} ISO 639-1 code or null if unknown
 */
const getLanguageCode = (language) => {
  const languageMap = {
    'english': 'en',
    'russian': 'ru',
    'italian': 'it',
    'spanish': 'es',
    'french': 'fr',
    'german': 'de',
    'portuguese': 'pt',
    'chinese': 'zh',
    'japanese': 'ja',
    'korean': 'ko',
    'arabic': 'ar',
    'hindi': 'hi',
    'turkish': 'tr',
    'dutch': 'nl',
    'polish': 'pl',
    'ukrainian': 'uk',
    'swedish': 'sv',
    'danish': 'da',
    'norwegian': 'no',
    'finnish': 'fi',
  };
  
  const normalized = language.toLowerCase().trim();
  return languageMap[normalized] || null;
};

// Rate limiting for Whisper API (3 requests per minute = 20s between calls)
let lastWhisperCall = 0;
const WHISPER_MIN_INTERVAL = 20000; // 20 seconds
const WHISPER_429_BACKOFF_MS = [
  20 * 1000,
  40 * 1000,
  60 * 1000,
  2 * 60 * 1000,
  3 * 60 * 1000,
  5 * 60 * 1000,
  10 * 60 * 1000,
  15 * 60 * 1000,
  20 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
];

const whisperQueue = [];
let whisperQueueProcessing = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatWaitTime = (ms) => {
  if (ms % (60 * 60 * 1000) === 0) {
    return `${ms / (60 * 60 * 1000)}h`;
  }
  if (ms % (60 * 1000) === 0) {
    return `${ms / (60 * 1000)}m`;
  }
  return `${ms / 1000}s`;
};

const getWhisperDeploymentName = () => {
  if (config.azureOpenAI.whisperEndpoint) {
    return null;
  }

  if (config.azureOpenAI.whisperDeploymentName) {
    return config.azureOpenAI.whisperDeploymentName;
  }

  return config.azureOpenAI.deploymentName || null;
};

const buildWhisperEndpointFromBase = (baseUrl, mode) => {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/\/audio\/(translations|transcriptions)$/, `/audio/${mode}`);
  return url.toString();
};

const getWhisperRequestConfig = (mode = 'transcriptions') => {
  if (config.azureOpenAI.whisperEndpoint) {
    return {
      url: buildWhisperEndpointFromBase(config.azureOpenAI.whisperEndpoint, mode),
      apiKey: config.azureOpenAI.whisperKey || config.azureOpenAI.apiKey,
      source: 'WHISPER_ENDPOINT',
      deploymentName: null,
    };
  }

  const deploymentName = getWhisperDeploymentName();
  if (!deploymentName) {
    return null;
  }

  return {
    url:
      `${config.azureOpenAI.endpoint}/openai/deployments/${encodeURIComponent(deploymentName)}` +
      `/audio/${mode}?api-version=${encodeURIComponent(config.azureOpenAI.whisperApiVersion)}`,
    apiKey: config.azureOpenAI.whisperKey || config.azureOpenAI.apiKey,
    source: 'AZURE_DEPLOYMENT_NAME',
    deploymentName,
  };
};

const executeWhisperRequest = async ({ audioPath, mode, targetLanguage, whisperRequest }) => {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioPath));
  formData.append('model', 'whisper-1');

  if (targetLanguage && mode === 'transcriptions') {
    const langCode = getLanguageCode(targetLanguage);
    if (langCode) {
      formData.append('language', langCode);
    }
  }

  formData.append('response_format', 'verbose_json');

  lastWhisperCall = Date.now();
  const response = await axios.post(
    whisperRequest.url,
    formData,
    {
      headers: {
        'api-key': whisperRequest.apiKey,
        ...formData.getHeaders(),
      },
      timeout: 60000,
    }
  );

  const data = response.data;
  const transcript = data.text?.trim() || '';
  const detectedLanguage = data.language || 'unknown';

  if (!transcript || transcript.length < 3) {
    return null;
  }

  return {
    text: transcript,
    language: detectedLanguage,
  };
};

const processWhisperQueue = async () => {
  if (whisperQueueProcessing) {
    return;
  }

  whisperQueueProcessing = true;

  try {
    while (whisperQueue.length > 0) {
      const item = whisperQueue.shift();

      try {
        const timeSinceLastCall = Date.now() - lastWhisperCall;
        if (timeSinceLastCall < WHISPER_MIN_INTERVAL) {
          const waitTime = WHISPER_MIN_INTERVAL - timeSinceLastCall;
          log.info(`Whisper rate limit: waiting ${(waitTime / 1000).toFixed(1)}s before next call`);
          await sleep(waitTime);
        }

        let retryIndex = 0;
        while (true) {
          try {
            const result = await executeWhisperRequest(item.job);
            item.resolve(result);
            break;
          } catch (error) {
            if (error.response?.status !== 429) {
              throw error;
            }

            if (retryIndex >= WHISPER_429_BACKOFF_MS.length) {
              const exhaustedError = new Error('Whisper rate limit retries exhausted');
              exhaustedError.code = 'WHISPER_RATE_LIMIT_EXHAUSTED';
              throw exhaustedError;
            }

            const waitTime = WHISPER_429_BACKOFF_MS[retryIndex];
            retryIndex += 1;
            log.warn(`Whisper rate limited, retrying in ${formatWaitTime(waitTime)} (attempt ${retryIndex}/${WHISPER_429_BACKOFF_MS.length})`);
            await sleep(waitTime);
          }
        }
      } catch (error) {
        item.reject(error);
      }
    }
  } finally {
    whisperQueueProcessing = false;
  }

  if (whisperQueue.length > 0) {
    setImmediate(() => {
      processWhisperQueue().catch(error => {
        log.error(`Whisper queue failed: ${error.message}`);
      });
    });
  }
};

const enqueueWhisperRequest = (job) => new Promise((resolve, reject) => {
  whisperQueue.push({ job, resolve, reject });
  processWhisperQueue().catch(error => {
    log.error(`Whisper queue failed: ${error.message}`);
  });
});

/**
 * Extract audio segment from video
 * @param {string} videoPath - Path to video file
 * @param {number} start - Start time in seconds
 * @param {number} end - End time in seconds
 * @param {string} outputPath - Path to save extracted audio
 * @returns {Promise<string>} Path to extracted audio file
 */
const extractAudioSegment = async (videoPath, start, end, outputPath) => {
  const duration = end - start;
  
  try {
    // Extract audio segment using ffmpeg
    // -ss: start time, -t: duration, -vn: no video, -acodec: audio codec
    execSync(
      `ffmpeg -i "${videoPath}" -ss ${start} -t ${duration} -vn -acodec libmp3lame -ar 16000 -ac 1 -ab 32k "${outputPath}" -y`,
      { stdio: 'pipe' }
    );
    
    // Check if file was created and has content
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error('Audio extraction produced empty file');
    }
    
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
};

/**
 * Transcribe audio using Azure OpenAI Whisper
 * @param {string} audioPath - Path to audio file
 * @param {string} targetLanguage - Optional target language for transcription (default: auto-detect)
 * @returns {Promise<Object|null>} Object with {text, language} or null if no speech detected
 */
const transcribeAudio = async (audioPath, targetLanguage = null, mode = 'transcriptions') => {
  const whisperRequest = getWhisperRequestConfig(mode);
  if (!whisperRequest?.apiKey) {
    log.warn('Whisper API key is not configured, skipping transcription');
    return null;
  }

  if (!whisperRequest?.url) {
    log.warn('Whisper endpoint is not configured. Set WHISPER_ENDPOINT or Azure deployment settings for transcription.');
    return null;
  }
  
  try {
    // Check file size (Whisper has a 25MB limit)
    const stats = fs.statSync(audioPath);
    if (stats.size > 25 * 1024 * 1024) {
      console.warn(`Audio file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB), skipping transcription`);
      return null;
    }
    
    // If file is too small (< 1KB), likely no audio
    if (stats.size < 1024) {
      return null;
    }
    
    return await enqueueWhisperRequest({
      audioPath,
      mode,
      targetLanguage,
      whisperRequest,
    });
  } catch (error) {
    if (error.code === 'AZURE_TRANSCRIPTION_CONFIG_ERROR') {
      throw error;
    }

    const errorData = error.response?.data;
    const errorText = typeof errorData === 'string'
      ? errorData
      : JSON.stringify(errorData || {});
    if (error.response?.status === 400 && errorText.toLowerCase().includes('no speech')) {
      return null;
    }

    const status = error.response?.status;
    const isUnsupportedOperation =
      status === 400 &&
      (
        errorText.toLowerCase().includes('operationnotsupported') ||
        errorText.toLowerCase().includes('not supported')
      );
    if (status === 404 || status === 401 || status === 403 || isUnsupportedOperation) {
      const endpointHost = (() => {
        try {
          return new URL(whisperRequest.url).host;
        } catch (urlError) {
          return 'unknown-host';
        }
      })();
      const fatalError = new Error(
        whisperRequest.deploymentName
          ? `Azure transcription request failed with ${status} for deployment "${whisperRequest.deploymentName}". ` +
            `This code uses ${whisperRequest.source} by default${config.azureOpenAI.whisperDeploymentName ? ' (overridden by AZURE_WHISPER_DEPLOYMENT_NAME)' : ''}.`
          : `Whisper endpoint request failed with ${status} at ${endpointHost}. ` +
            `This code is using WHISPER_ENDPOINT directly.`
      );
      fatalError.code = 'AZURE_TRANSCRIPTION_CONFIG_ERROR';
      fatalError.status = status;
      throw fatalError;
    }

    const trimmedBody = errorText && errorText !== '{}'
      ? ` body=${errorText.substring(0, 180)}`
      : '';
    log.error(`Transcription failed${status ? ` (${status})` : ''}: ${error.message}${trimmedBody}`);
    log.error(`Transcription error: ${error.message}`);
    return null;
  }
};

/**
 * Transcribe scene audio from video
 * @param {string} videoPath - Path to video file
 * @param {number} sceneId - Scene identifier
 * @param {number} start - Scene start time
 * @param {number} end - Scene end time
 * @param {string} tempDir - Directory for temporary files
 * @param {string} targetLanguage - Optional target language for transcription
 * @returns {Promise<Object|null>} Transcript object with text and metadata, or null
 */
const transcribeSceneAudio = async (videoPath, sceneId, start, end, tempDir, targetLanguage = null) => {
  const audioPath = path.join(tempDir, `scene-${sceneId}-audio.mp3`);
  
  try {
    // Extract audio segment
    await extractAudioSegment(videoPath, start, end, audioPath);

    const originalResult = await transcribeAudio(audioPath, targetLanguage, 'transcriptions');
    let englishResult = null;

    if (originalResult && originalResult.text) {
      const normalizedOriginalLanguage = (originalResult.language || '').toLowerCase();
      if (normalizedOriginalLanguage && normalizedOriginalLanguage !== 'en' && normalizedOriginalLanguage !== 'english') {
        englishResult = await transcribeAudio(audioPath, null, 'translations');
      }
    }

    // Clean up temp audio file
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    
    if (!originalResult && !englishResult) {
      return null;
    }

    const originalText = originalResult?.text || null;
    const englishText = englishResult?.text || originalResult?.text || null;

    return {
      text: englishText,
      englishText,
      originalText,
      originalLanguage: originalResult?.language || null,
      start,
      end,
      duration: end - start,
      language: originalResult?.language || englishResult?.language || 'unknown',
    };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }

    if (error.code === 'AZURE_TRANSCRIPTION_CONFIG_ERROR') {
      throw error;
    }

    log.error(`Failed to transcribe scene ${sceneId}: ${error.message}`);
    return null;
  }
};

module.exports = {
  extractAudioSegment,
  getWhisperDeploymentName,
  transcribeAudio,
  transcribeSceneAudio,
};
