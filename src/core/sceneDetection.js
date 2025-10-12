const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Detect scene changes in a video using ffmpeg
 * Returns array of scenes with start/end timestamps
 * 
 * @param {string} videoPath - Path to video file
 * @param {number} threshold - Scene change threshold (0.0-1.0, default 0.4)
 * @returns {Promise<Array>} Array of scenes [{sceneId, start, end, duration}]
 */
const detectScenes = async (videoPath, threshold = 0.4) => {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  console.log(`🎬 Detecting scenes in: ${path.basename(videoPath)}`);
  console.log(`   Threshold: ${threshold}`);

  // First, get video duration
  const duration = await getVideoDuration(videoPath);
  console.log(`   Duration: ${duration.toFixed(2)}s`);

  // Use ffmpeg scene detection filter
  // The scene filter outputs timestamps where scene changes occur
  const sceneTimestamps = await runSceneDetection(videoPath, threshold);
  
  console.log(`   Found ${sceneTimestamps.length} scene changes`);

  // Convert timestamps to scene segments
  const scenes = [];
  
  // First scene starts at 0
  let sceneStart = 0;
  
  for (let i = 0; i < sceneTimestamps.length; i++) {
    const sceneEnd = sceneTimestamps[i];
    scenes.push({
      sceneId: i + 1,
      start: parseFloat(sceneStart.toFixed(3)),
      end: parseFloat(sceneEnd.toFixed(3)),
      duration: parseFloat((sceneEnd - sceneStart).toFixed(3)),
    });
    sceneStart = sceneEnd;
  }
  
  // Last scene goes to end of video
  if (sceneStart < duration) {
    scenes.push({
      sceneId: scenes.length + 1,
      start: parseFloat(sceneStart.toFixed(3)),
      end: parseFloat(duration.toFixed(3)),
      duration: parseFloat((duration - sceneStart).toFixed(3)),
    });
  }

  console.log(`   ✓ Created ${scenes.length} scene segments`);

  return scenes;
};

/**
 * Get video duration using ffprobe
 */
const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let output = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      console.error(`ffprobe stderr: ${data}`);
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
      } else {
        const duration = parseFloat(output.trim());
        resolve(duration);
      }
    });
  });
};

/**
 * Run ffmpeg scene detection and extract timestamps
 */
const runSceneDetection = (videoPath, threshold) => {
  return new Promise((resolve, reject) => {
    // ffmpeg command to detect scenes
    // -filter:v select='gt(scene,THRESHOLD)' detects scene changes
    // showinfo outputs frame info including timestamps
    // -f null discards output (we only need the logs)
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-filter:v', `select='gt(scene,${threshold})',showinfo`,
      '-f', 'null',
      '-'
    ]);

    let stderrOutput = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      // ffmpeg outputs frame info to stderr
      // Parse the showinfo output to extract timestamps
      const timestamps = parseShowinfoOutput(stderrOutput);
      resolve(timestamps);
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`ffmpeg error: ${error.message}`));
    });
  });
};

/**
 * Parse ffmpeg showinfo output to extract frame timestamps
 */
const parseShowinfoOutput = (output) => {
  const timestamps = [];
  
  // showinfo outputs lines like: [Parsed_showinfo_1 @ ...] n:0 pts:0 pts_time:0.000000 ...
  // We want to extract pts_time values
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (line.includes('showinfo') && line.includes('pts_time:')) {
      // Extract pts_time value
      const match = line.match(/pts_time:([\d.]+)/);
      if (match) {
        const timestamp = parseFloat(match[1]);
        if (!isNaN(timestamp) && timestamp > 0) {
          timestamps.push(timestamp);
        }
      }
    }
  }
  
  // Sort and deduplicate timestamps
  const uniqueTimestamps = [...new Set(timestamps)].sort((a, b) => a - b);
  
  return uniqueTimestamps;
};

/**
 * Extract 3 frames per scene (beginning, middle, end)
 * @param {string} videoPath - Path to video file
 * @param {Array} scenes - Array of scene objects
 * @param {string} outputDir - Directory to save frames
 * @returns {Promise<Array>} Updated scenes with frame paths
 */
const extractSceneFrames = async (videoPath, scenes, outputDir) => {
  console.log(`\n📸 Extracting frames for ${scenes.length} scenes...`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const updatedScenes = [];

  for (const scene of scenes) {
    const { sceneId, start, end, duration } = scene;
    
    // Calculate 3 timestamps: beginning (10%), middle (50%), end (90%)
    const timestamps = [
      start + duration * 0.1,  // 10% into scene
      start + duration * 0.5,  // Middle
      start + duration * 0.9,  // 90% into scene
    ];

    const frames = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const frameName = `scene_${sceneId}_frame_${i + 1}.jpg`;
      const framePath = path.join(outputDir, frameName);

      try {
        await extractFrame(videoPath, timestamp, framePath);
        frames.push({
          frameId: i + 1,
          timestamp: parseFloat(timestamp.toFixed(3)),
          path: framePath,
          relativePath: path.relative(process.cwd(), framePath),
        });
      } catch (error) {
        console.error(`   ✗ Failed to extract frame ${i + 1} for scene ${sceneId}: ${error.message}`);
      }
    }

    updatedScenes.push({
      ...scene,
      frames,
    });

    console.log(`   ✓ Scene ${sceneId}: extracted ${frames.length}/3 frames`);
  }

  console.log(`✓ Extracted ${updatedScenes.reduce((sum, s) => sum + s.frames.length, 0)} total frames`);

  return updatedScenes;
};

/**
 * Extract a single frame at specific timestamp
 */
const extractFrame = (videoPath, timestamp, outputPath) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-ss', timestamp.toString(),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      outputPath
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      } else {
        resolve(outputPath);
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
};

module.exports = {
  detectScenes,
  extractSceneFrames,
};
