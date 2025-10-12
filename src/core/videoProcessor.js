const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Extract frames from video at regular intervals
 */
const extractFrames = (videoPath, outputDir) => {
  return new Promise((resolve, reject) => {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const frames = [];
    const fps = 1 / config.sceneDurationSeconds; // 1 frame every N seconds

    ffmpeg(videoPath)
      .on('end', () => {
        // Get list of generated frames
        const files = fs.readdirSync(outputDir)
          .filter(f => f.endsWith('.jpg'))
          .sort()
          .map(f => path.join(outputDir, f));
        
        resolve(files);
      })
      .on('error', (err) => {
        console.error('Error extracting frames:', err);
        reject(err);
      })
      .screenshots({
        count: config.framesPerScene,
        folder: outputDir,
        filename: 'frame-%04d.jpg',
        size: '1280x720',
      });
  });
};

/**
 * Get video metadata
 */
const getVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });
};

/**
 * Process video: extract frames and metadata
 */
const processVideo = async (videoPath, videoId) => {
  try {
    // Create output directory for this video
    const outputDir = path.join(config.outputDir, videoId);
    
    // Get metadata
    const metadata = await getVideoMetadata(videoPath);
    const duration = metadata.format.duration;
    
    console.log(`Processing video: ${videoPath}`);
    console.log(`Duration: ${duration}s`);
    
    // Extract frames
    const frames = await extractFrames(videoPath, outputDir);
    
    console.log(`Extracted ${frames.length} frames`);
    
    return {
      videoId,
      duration,
      frames,
      metadata: {
        format: metadata.format,
        streams: metadata.streams,
      },
    };
  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
};

module.exports = {
  extractFrames,
  getVideoMetadata,
  processVideo,
};
