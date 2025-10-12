/**
 * Audio Transcription using Whisper (Azure OpenAI)
 * Extracts audio from video scenes and transcribes dialogue
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const config = require('../config');

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
 * @returns {Promise<string|null>} Transcribed text or null if no speech detected
 */
const transcribeAudio = async (audioPath) => {
  if (!config.azureOpenAI.apiKey) {
    console.warn('Azure OpenAI not configured, skipping transcription');
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
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Can be made configurable
    formData.append('response_format', 'text');
    
    // Call Azure OpenAI Whisper API
    const response = await axios.post(
      `${config.azureOpenAI.endpoint}/openai/deployments/whisper/audio/transcriptions?api-version=2024-06-01`,
      formData,
      {
        headers: {
          'api-key': config.azureOpenAI.apiKey,
          ...formData.getHeaders(),
        },
        timeout: 60000, // 60 seconds
      }
    );
    
    const transcript = response.data.trim();
    
    // Return null if transcript is empty or just noise markers
    if (!transcript || transcript.length < 3) {
      return null;
    }
    
    return transcript;
  } catch (error) {
    // Don't throw - transcription failure shouldn't stop scene description
    if (error.response?.status === 400 && error.response?.data?.includes('no speech')) {
      // No speech detected - this is fine
      return null;
    }
    
    console.error(`Transcription failed: ${error.message}`);
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
 * @returns {Promise<Object|null>} Transcript object with text and metadata, or null
 */
const transcribeSceneAudio = async (videoPath, sceneId, start, end, tempDir) => {
  const audioPath = path.join(tempDir, `scene-${sceneId}-audio.mp3`);
  
  try {
    // Extract audio segment
    await extractAudioSegment(videoPath, start, end, audioPath);
    
    // Transcribe audio
    const transcript = await transcribeAudio(audioPath);
    
    // Clean up temp audio file
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    
    if (!transcript) {
      return null;
    }
    
    return {
      text: transcript,
      start,
      end,
      duration: end - start,
      language: 'en',
    };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    
    console.error(`Failed to transcribe scene ${sceneId}: ${error.message}`);
    return null;
  }
};

module.exports = {
  extractAudioSegment,
  transcribeAudio,
  transcribeSceneAudio,
};
