const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_THRESHOLD = 0.4;
const DEFAULT_MOTION_THRESHOLD = 0.12;
const DEFAULT_MOTION_MIN_SCENE_DURATION = 1.0;
const DEFAULT_MIN_FRAMES_PER_SCENE = 3;
const SUPPORTED_SPLIT_MODES = new Set(['cut', 'motion', 'hybrid']);

const roundTimestamp = (value) => parseFloat(value.toFixed(3));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parseFraction = (value, fallback, label) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error(`${label} must be a number greater than 0 and at most 1`);
  }

  return parsed;
};

const parseNonNegativeNumber = (value, fallback, label) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a number greater than or equal to 0`);
  }

  return parsed;
};

const parsePositiveNumber = (value, fallback, label) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a number greater than 0`);
  }

  return parsed;
};

const parsePositiveInteger = (value, fallback, label) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
};

const normalizeSplitMode = (value) => {
  const splitMode = typeof value === 'string' ? value.trim().toLowerCase() : 'cut';
  if (!SUPPORTED_SPLIT_MODES.has(splitMode)) {
    throw new Error(`Unsupported splitMode "${value}". Supported modes: cut, motion, hybrid`);
  }
  return splitMode;
};

const normalizeDetectionOptions = (optionsOrThreshold = DEFAULT_THRESHOLD) => {
  const options = typeof optionsOrThreshold === 'number'
    ? { threshold: optionsOrThreshold }
    : (optionsOrThreshold || {});

  const splitMode = normalizeSplitMode(options.splitMode);
  const threshold = parseFraction(options.threshold, DEFAULT_THRESHOLD, 'threshold');
  const motionThreshold = parseFraction(
    options.motionThreshold,
    Math.min(threshold, DEFAULT_MOTION_THRESHOLD),
    'motionThreshold'
  );
  const minSceneDuration = parseNonNegativeNumber(
    options.minSceneDuration,
    splitMode === 'cut' ? 0 : DEFAULT_MOTION_MIN_SCENE_DURATION,
    'minSceneDuration'
  );

  return {
    threshold,
    splitMode,
    motionThreshold,
    minSceneDuration,
  };
};

const normalizeFrameExtractionOptions = (options = {}) => {
  const source = typeof options === 'object' && options !== null ? options : {};

  return {
    frameFps: parsePositiveNumber(source.frameFps ?? source.fps, null, 'frameFps'),
    minFramesPerScene: parsePositiveInteger(
      source.minFramesPerScene,
      DEFAULT_MIN_FRAMES_PER_SCENE,
      'minFramesPerScene'
    ),
  };
};

const consolidateSceneTimestamps = (timestamps, duration, minSceneDuration = 0) => {
  const uniqueTimestamps = [...new Set(
    timestamps
      .map((timestamp) => Number(timestamp))
      .filter((timestamp) => (
        Number.isFinite(timestamp) &&
        timestamp > 0 &&
        timestamp < duration &&
        (minSceneDuration <= 0 || (
          timestamp >= minSceneDuration - 0.0001 &&
          duration - timestamp >= minSceneDuration - 0.0001
        ))
      ))
      .map(roundTimestamp)
  )].sort((a, b) => a - b);

  const consolidated = [];
  for (const timestamp of uniqueTimestamps) {
    if (
      consolidated.length === 0 ||
      timestamp - consolidated[consolidated.length - 1] >= minSceneDuration - 0.0001
    ) {
      consolidated.push(timestamp);
    }
  }

  return consolidated;
};

const createScenesFromTimestamps = (timestamps, duration) => {
  const scenes = [];
  let sceneStart = 0;

  for (let i = 0; i < timestamps.length; i++) {
    const sceneEnd = timestamps[i];
    scenes.push({
      sceneId: i + 1,
      start: roundTimestamp(sceneStart),
      end: roundTimestamp(sceneEnd),
      duration: roundTimestamp(sceneEnd - sceneStart),
    });
    sceneStart = sceneEnd;
  }

  if (sceneStart < duration || scenes.length === 0) {
    scenes.push({
      sceneId: scenes.length + 1,
      start: roundTimestamp(sceneStart),
      end: roundTimestamp(duration),
      duration: roundTimestamp(Math.max(0, duration - sceneStart)),
    });
  }

  return scenes;
};

const getSafeFrameTimestamp = (timestamp, start, end) => {
  const duration = Math.max(0, end - start);
  if (duration <= 0.001) {
    return roundTimestamp(start);
  }

  const edgePadding = Math.min(0.05, duration / 10);
  const minTimestamp = start + edgePadding;
  const maxTimestamp = Math.max(minTimestamp, end - edgePadding);

  return roundTimestamp(clamp(timestamp, minTimestamp, maxTimestamp));
};

const buildKeyframeTimestamps = (start, end) => {
  const duration = Math.max(0, end - start);
  if (duration <= 0.001) {
    return [roundTimestamp(start)];
  }

  return [...new Set(
    [0.1, 0.5, 0.9].map((ratio) => getSafeFrameTimestamp(start + duration * ratio, start, end))
  )];
};

const buildFpsTimestamps = (start, end, frameFps, minFramesPerScene) => {
  const duration = Math.max(0, end - start);
  if (duration <= 0.001) {
    return [roundTimestamp(start)];
  }

  const frameCount = Math.max(minFramesPerScene, Math.ceil(duration * frameFps));
  if (frameCount <= 1) {
    return [getSafeFrameTimestamp(start + duration / 2, start, end)];
  }

  return [...new Set(
    Array.from({ length: frameCount }, (_, index) => {
      const ratio = frameCount === 1 ? 0.5 : index / (frameCount - 1);
      return getSafeFrameTimestamp(start + duration * ratio, start, end);
    })
  )];
};

/**
 * Detect scene changes in a video using ffmpeg.
 * Returns array of scenes with start/end timestamps.
 *
 * splitMode:
 * - cut: existing hard-cut behavior
 * - motion: lower-threshold visual change detection for movement-heavy shots
 * - hybrid: combine hard cuts and motion-sensitive boundaries
 *
 * @param {string} videoPath - Path to video file
 * @param {number|Object} optionsOrThreshold - Threshold or detailed options
 * @returns {Promise<Array>} Array of scenes [{sceneId, start, end, duration}]
 */
const detectScenes = async (videoPath, optionsOrThreshold = DEFAULT_THRESHOLD) => {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const options = normalizeDetectionOptions(optionsOrThreshold);

  console.log(`🎬 Detecting scenes in: ${path.basename(videoPath)}`);
  console.log(`   Split mode: ${options.splitMode}`);
  console.log(`   Cut threshold: ${options.threshold}`);
  if (options.splitMode !== 'cut') {
    console.log(`   Motion threshold: ${options.motionThreshold}`);
    console.log(`   Min scene duration: ${options.minSceneDuration}s`);
  }

  const duration = await getVideoDuration(videoPath);
  console.log(`   Duration: ${duration.toFixed(2)}s`);

  let sceneTimestamps = [];
  if (options.splitMode === 'cut') {
    sceneTimestamps = await runSceneDetection(videoPath, options.threshold);
    sceneTimestamps = consolidateSceneTimestamps(sceneTimestamps, duration, options.minSceneDuration);
  } else if (options.splitMode === 'motion') {
    sceneTimestamps = await runSceneDetection(videoPath, options.motionThreshold);
    sceneTimestamps = consolidateSceneTimestamps(sceneTimestamps, duration, options.minSceneDuration);
  } else {
    const [cutTimestamps, motionTimestamps] = await Promise.all([
      runSceneDetection(videoPath, options.threshold),
      runSceneDetection(videoPath, options.motionThreshold),
    ]);

    console.log(`   Hard-cut boundaries: ${cutTimestamps.length}`);
    console.log(`   Motion-sensitive boundaries: ${motionTimestamps.length}`);

    sceneTimestamps = consolidateSceneTimestamps(
      [...cutTimestamps, ...motionTimestamps],
      duration,
      options.minSceneDuration
    );
  }

  console.log(`   Found ${sceneTimestamps.length} scene boundaries`);

  const scenes = createScenesFromTimestamps(sceneTimestamps, duration);
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
 * Extract representative frames for each scene.
 * By default this keeps the original keyframe strategy (first-ish, middle, last-ish).
 * If frameFps is provided, the scene is sampled at least that densely across its duration.
 *
 * @param {string} videoPath - Path to video file
 * @param {Array} scenes - Array of scene objects
 * @param {string} outputDir - Directory to save frames
 * @param {Object} options - Frame extraction options
 * @returns {Promise<Array>} Updated scenes with frame paths
 */
const extractSceneFrames = async (videoPath, scenes, outputDir, options = {}) => {
  const frameOptions = normalizeFrameExtractionOptions(options);
  const samplingLabel = frameOptions.frameFps
    ? `minimum ${frameOptions.frameFps} fps`
    : 'keyframes (first/middle/last)';

  console.log(`\n📸 Extracting frames for ${scenes.length} scenes...`);
  console.log(`   Sampling: ${samplingLabel}`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const updatedScenes = [];

  for (const scene of scenes) {
    const { sceneId, start, end, duration } = scene;
    const timestamps = frameOptions.frameFps
      ? buildFpsTimestamps(start, end, frameOptions.frameFps, frameOptions.minFramesPerScene)
      : buildKeyframeTimestamps(start, end);

    const frames = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const frameName = `scene_${sceneId}_frame_${String(i + 1).padStart(4, '0')}.jpg`;
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
      duration,
      frameSampling: {
        strategy: frameOptions.frameFps ? 'fps' : 'keyframes',
        fps: frameOptions.frameFps || null,
        minFramesPerScene: frameOptions.minFramesPerScene,
        frameCount: frames.length,
      },
      frames,
    });

    console.log(`   ✓ Scene ${sceneId}: extracted ${frames.length}/${timestamps.length} frames`);
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
  normalizeDetectionOptions,
  normalizeFrameExtractionOptions,
};
