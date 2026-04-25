const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_SPLIT_MODE = 'hybrid';
const DEFAULT_THRESHOLD = 0.4;
const DEFAULT_MOTION_THRESHOLD = 0.12;
const DEFAULT_MOTION_MIN_SCENE_DURATION = 1.0;
const DEFAULT_VISUAL_THRESHOLD = 0.9;
const DEFAULT_VISUAL_SAMPLE_FPS = 1;
const DEFAULT_VISUAL_WINDOW_SECONDS = 3;
const DEFAULT_VISUAL_MIN_BOUNDARY_SPACING = 4.5;
const VISUAL_FRAME_WIDTH = 64;
const VISUAL_FRAME_HEIGHT = 36;
const DEFAULT_MIN_FRAMES_PER_SCENE = 3;
const SUPPORTED_SPLIT_MODES = new Set(['cut', 'motion', 'visual', 'hybrid']);

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
  const splitMode = typeof value === 'string' ? value.trim().toLowerCase() : DEFAULT_SPLIT_MODE;
  if (!SUPPORTED_SPLIT_MODES.has(splitMode)) {
    throw new Error(`Unsupported splitMode "${value}". Supported modes: cut, motion, visual, hybrid`);
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
  const visualThreshold = parsePositiveNumber(
    options.visualThreshold,
    DEFAULT_VISUAL_THRESHOLD,
    'visualThreshold'
  );
  const visualSampleFps = parsePositiveNumber(
    options.visualSampleFps,
    DEFAULT_VISUAL_SAMPLE_FPS,
    'visualSampleFps'
  );
  const visualWindowSeconds = parsePositiveNumber(
    options.visualWindowSeconds,
    DEFAULT_VISUAL_WINDOW_SECONDS,
    'visualWindowSeconds'
  );
  const visualMinBoundarySpacing = parsePositiveNumber(
    options.visualMinBoundarySpacing,
    DEFAULT_VISUAL_MIN_BOUNDARY_SPACING,
    'visualMinBoundarySpacing'
  );

  return {
    threshold,
    splitMode,
    motionThreshold,
    minSceneDuration,
    visualThreshold,
    visualSampleFps,
    visualWindowSeconds,
    visualMinBoundarySpacing,
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
 * - visual: sampled-frame window comparison for gradual transitions
 * - hybrid: combine hard cuts, motion-sensitive boundaries, and visual-window changes
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
  if (options.splitMode === 'visual' || options.splitMode === 'hybrid') {
    console.log(`   Visual threshold: ${options.visualThreshold}`);
    console.log(`   Visual sample FPS: ${options.visualSampleFps}`);
    console.log(`   Visual window: ${options.visualWindowSeconds}s`);
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
  } else if (options.splitMode === 'visual') {
    sceneTimestamps = await runVisualSceneDetection(videoPath, duration, options);
    sceneTimestamps = consolidateSceneTimestamps(sceneTimestamps, duration, options.minSceneDuration);
  } else {
    const [cutTimestamps, motionTimestamps, visualTimestamps] = await Promise.all([
      runSceneDetection(videoPath, options.threshold),
      runSceneDetection(videoPath, options.motionThreshold),
      runVisualSceneDetection(videoPath, duration, options),
    ]);

    console.log(`   Hard-cut boundaries: ${cutTimestamps.length}`);
    console.log(`   Motion-sensitive boundaries: ${motionTimestamps.length}`);
    console.log(`   Visual-window boundaries: ${visualTimestamps.length}`);

    sceneTimestamps = consolidateSceneTimestamps(
      [...cutTimestamps, ...motionTimestamps, ...visualTimestamps],
      duration,
      options.minSceneDuration
    );
  }

  console.log(`   Found ${sceneTimestamps.length} scene boundaries`);

  const scenes = createScenesFromTimestamps(sceneTimestamps, duration);
  console.log(`   ✓ Created ${scenes.length} scene segments`);

  return scenes;
};

const runVisualSceneDetection = async (videoPath, duration, options) => {
  const frames = await extractVisualFeatures(videoPath, options.visualSampleFps);
  const windowFrames = Math.max(1, Math.round(options.visualWindowSeconds * options.visualSampleFps));

  if (frames.length < windowFrames * 2 + 1) {
    console.log(`   Visual-window analysis skipped: only ${frames.length} sampled frames`);
    return [];
  }

  const scores = buildVisualWindowScores(frames, options.visualSampleFps, windowFrames);
  const scoreThreshold = getVisualScoreThreshold(scores, options.visualThreshold);
  const candidates = findVisualBoundaryCandidates(scores, scoreThreshold, duration, options.minSceneDuration);
  const selected = selectSpacedVisualBoundaries(candidates, options.visualMinBoundarySpacing);

  console.log(`   Visual-window sampled frames: ${frames.length}`);
  console.log(`   Visual-window score threshold: ${scoreThreshold.toFixed(3)}`);
  console.log(`   Visual-window candidates: ${candidates.length}`);

  return selected.map(candidate => candidate.timestamp);
};

const extractVisualFeatures = (videoPath, sampleFps) => {
  return new Promise((resolve, reject) => {
    const width = VISUAL_FRAME_WIDTH;
    const height = VISUAL_FRAME_HEIGHT;
    const frameSize = width * height * 3;
    const ffmpeg = spawn('ffmpeg', [
      '-v', 'error',
      '-i', videoPath,
      '-vf', `fps=${sampleFps},scale=${width}:${height}`,
      '-f', 'rawvideo',
      '-pix_fmt', 'rgb24',
      '-',
    ]);

    const chunks = [];
    let stderr = '';

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg visual analysis exited with code ${code}: ${stderr}`));
        return;
      }

      const buffer = Buffer.concat(chunks);
      const frames = [];
      for (let offset = 0; offset + frameSize <= buffer.length; offset += frameSize) {
        frames.push(extractVisualFrameFeature(buffer, offset, width, height));
      }

      resolve(frames);
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
};

const extractVisualFrameFeature = (buffer, offset, width, height) => {
  const histogram = new Array(64).fill(0);
  const cellsX = 4;
  const cellsY = 3;
  const cellSums = Array.from({ length: cellsX * cellsY }, () => [0, 0, 0, 0]);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelOffset = offset + (y * width + x) * 3;
      const red = buffer[pixelOffset];
      const green = buffer[pixelOffset + 1];
      const blue = buffer[pixelOffset + 2];

      histogram[(red >> 6) * 16 + (green >> 6) * 4 + (blue >> 6)]++;

      const cellX = Math.min(cellsX - 1, Math.floor(x / (width / cellsX)));
      const cellY = Math.min(cellsY - 1, Math.floor(y / (height / cellsY)));
      const cell = cellSums[cellY * cellsX + cellX];
      cell[0] += red;
      cell[1] += green;
      cell[2] += blue;
      cell[3]++;
    }
  }

  const totalPixels = width * height;
  const feature = histogram.map(value => value / totalPixels);

  for (const [red, green, blue, count] of cellSums) {
    feature.push(red / count / 255);
    feature.push(green / count / 255);
    feature.push(blue / count / 255);
  }

  return feature;
};

const buildVisualWindowScores = (frames, sampleFps, windowFrames) => {
  const scores = [];

  for (let index = windowFrames; index < frames.length - windowFrames; index++) {
    const before = meanFeature(frames, index - windowFrames, index);
    const after = meanFeature(frames, index, index + windowFrames);
    scores.push({
      timestamp: index / sampleFps,
      score: featureDistance(before, after),
    });
  }

  return scores;
};

const meanFeature = (features, start, end) => {
  const count = end - start;
  const mean = new Array(features[0].length).fill(0);

  for (let index = start; index < end; index++) {
    for (let featureIndex = 0; featureIndex < mean.length; featureIndex++) {
      mean[featureIndex] += features[index][featureIndex] / count;
    }
  }

  return mean;
};

const featureDistance = (left, right) => {
  let sum = 0;

  for (let index = 0; index < left.length; index++) {
    const diff = left[index] - right[index];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
};

const getVisualScoreThreshold = (scores, floor) => {
  if (scores.length === 0) {
    return floor;
  }

  const values = scores.map(score => score.score).sort((left, right) => left - right);
  const median = values[Math.floor(values.length / 2)] || 0;
  const deviations = values
    .map(value => Math.abs(value - median))
    .sort((left, right) => left - right);
  const mad = deviations[Math.floor(deviations.length / 2)] || 0;

  return Math.max(floor, median + mad * 0.75);
};

const findVisualBoundaryCandidates = (scores, threshold, duration, minSceneDuration) => {
  const candidates = [];

  for (let index = 0; index < scores.length; index++) {
    const previous = index > 0 ? scores[index - 1].score : -Infinity;
    const next = index < scores.length - 1 ? scores[index + 1].score : -Infinity;
    const current = scores[index];

    if (
      current.score >= threshold &&
      current.score >= previous &&
      current.score >= next &&
      current.timestamp >= minSceneDuration - 0.0001 &&
      duration - current.timestamp >= minSceneDuration - 0.0001
    ) {
      candidates.push(current);
    }
  }

  return candidates;
};

const selectSpacedVisualBoundaries = (candidates, minBoundarySpacing) => {
  const selected = [];

  for (const candidate of [...candidates].sort((left, right) => right.score - left.score)) {
    if (selected.every(existing => Math.abs(existing.timestamp - candidate.timestamp) >= minBoundarySpacing)) {
      selected.push(candidate);
    }
  }

  return selected.sort((left, right) => left.timestamp - right.timestamp);
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
