const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { processVideo } = require('../core/videoProcessor');
const { describeImage, describeScene } = require('../core/gemini');
const { loadPrompts, runFPOIteration } = require('../core/promptOptimizer');
const { logVideoAnalysis } = require('../core/weave');
const { detectScenes, extractSceneFrames } = require('../core/sceneDetection');

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (req, file, cb) => {
    // Check file extension
    const allowedExtensions = /\.(mp4|avi|mov|mkv|webm)$/i;
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    
    // Check mimetype - video files can have various mimetypes
    const allowedMimetypes = /^video\//i;
    const validMimetype = allowedMimetypes.test(file.mimetype);
    
    if (extname || validMimetype) {
      return cb(null, true);
    } else {
      cb(new Error(`Only video files are allowed. Got: ${file.mimetype}`));
    }
  },
});

/**
 * POST /api/upload
 * Upload a video file
 */
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const videoId = path.basename(req.file.filename, path.extname(req.file.filename));
    
    res.json({
      success: true,
      videoId,
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analyze
 * Analyze a video and generate scene descriptions
 */
router.post('/analyze', async (req, res) => {
  try {
    const { videoId, promptId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    // Find video file
    const videoFiles = fs.readdirSync(config.uploadDir)
      .filter(f => f.startsWith(videoId));
    
    if (videoFiles.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoPath = path.join(config.uploadDir, videoFiles[0]);
    
    // Process video to extract frames
    console.log('Processing video...');
    const processResult = await processVideo(videoPath, videoId);
    
    // Load prompts
    const prompts = loadPrompts();
    const selectedPrompt = promptId
      ? prompts.templates.find(p => p.id === promptId)
      : prompts.templates.find(p => p.id === prompts.global_prompt) || prompts.templates[0];
    
    if (!selectedPrompt) {
      return res.status(400).json({ error: 'Invalid promptId' });
    }

    // Generate descriptions for each frame
    console.log(`Generating descriptions with prompt: ${selectedPrompt.id}`);
    const descriptions = [];
    
    for (let i = 0; i < processResult.frames.length; i++) {
      const frame = processResult.frames[i];
      console.log(`Analyzing frame ${i + 1}/${processResult.frames.length}`);
      
      const description = await describeImage(frame, selectedPrompt.template);
      
      descriptions.push({
        frameNumber: i + 1,
        framePath: frame,
        timestamp: (i * config.sceneDurationSeconds),
        description,
      });
    }

    // Save results
    const resultPath = path.join(config.outputDir, `${videoId}_descriptions.json`);
    const result = {
      videoId,
      promptId: selectedPrompt.id,
      promptTemplate: selectedPrompt.template,
      frameCount: descriptions.length,
      duration: processResult.duration,
      descriptions,
      timestamp: new Date().toISOString(),
    };
    
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

    // Log to Weave
    await logVideoAnalysis({
      videoId,
      promptId: selectedPrompt.id,
      frameCount: descriptions.length,
      duration: processResult.duration,
    });

    res.json({
      success: true,
      result,
      outputPath: resultPath,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/detect-scenes
 * Detect scenes in a video and optionally extract frames
 */
router.post('/detect-scenes', async (req, res) => {
  try {
    const { videoId, threshold = 0.4, extractFrames = false, describeScenes = false } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    // Find video file
    const videoFiles = fs.readdirSync(config.uploadDir)
      .filter(f => f.startsWith(videoId));
    
    if (videoFiles.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoPath = path.join(config.uploadDir, videoFiles[0]);
    
    // Detect scenes
    console.log(`\n🎬 Scene detection for: ${videoId}`);
    let scenes = await detectScenes(videoPath, threshold);
    
    // Optionally extract frames
    if (extractFrames) {
      const framesDir = path.join(config.outputDir, `${videoId}_scenes`);
      scenes = await extractSceneFrames(videoPath, scenes, framesDir);
      
      // Optionally describe scenes based on frames
      if (describeScenes) {
        console.log(`\n📝 Generating scene descriptions...`);
        
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          
          if (scene.frames && scene.frames.length > 0) {
            try {
              console.log(`  Describing scene ${scene.sceneId}...`);
              
              // Get absolute paths to frame files
              const framePaths = scene.frames.map(frame => frame.path);
              
              // Generate description
              const description = await describeScene(
                framePaths,
                scene.sceneId,
                scene.start,
                scene.end
              );
              
              // Add description to scene
              scene.description = description;
              console.log(`  ✓ Scene ${scene.sceneId}: ${description.substring(0, 60)}...`);
            } catch (error) {
              console.error(`  ✗ Failed to describe scene ${scene.sceneId}:`, error.message);
              scene.description = null;
            }
          }
        }
        
        console.log(`✓ Scene descriptions complete\n`);
      }
    }

    // Save scene data
    const scenesPath = path.join(config.outputDir, `${videoId}_scenes.json`);
    const sceneData = {
      videoId,
      videoPath,
      threshold,
      sceneCount: scenes.length,
      scenes,
      timestamp: new Date().toISOString(),
    };
    
    fs.writeFileSync(scenesPath, JSON.stringify(sceneData, null, 2));

    console.log(`✓ Scene detection complete: ${scenes.length} scenes detected`);
    console.log(`✓ Saved to: ${scenesPath}\n`);

    res.json({
      success: true,
      videoId,
      sceneCount: scenes.length,
      scenes,
      outputPath: scenesPath,
    });
  } catch (error) {
    console.error('Scene detection error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prompts
 * Get all prompt templates
 */
router.get('/prompts', (req, res) => {
  try {
    const prompts = loadPrompts();
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/results/:videoId
 * Get analysis results for a video
 */
router.get('/results/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;
    const resultPath = path.join(config.outputDir, `${videoId}_descriptions.json`);
    
    if (!fs.existsSync(resultPath)) {
      return res.status(404).json({ error: 'Results not found' });
    }

    const results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/fpo/run
 * Run Federated Prompt Optimization
 */
router.post('/fpo/run', async (req, res) => {
  try {
    const { 
      iterations = 3,
      enableEvolution = true,
      evolutionInterval = 2,
    } = req.body;
    
    // Find an actual extracted frame to use for testing
    let testFramePath = null;
    try {
      const outputDirs = fs.readdirSync(config.outputDir)
        .filter(d => d.startsWith('video-') && fs.statSync(path.join(config.outputDir, d)).isDirectory());
      
      if (outputDirs.length > 0) {
        const latestDir = outputDirs[outputDirs.length - 1];
        const frames = fs.readdirSync(path.join(config.outputDir, latestDir))
          .filter(f => f.endsWith('.jpg'));
        
        if (frames.length > 0) {
          testFramePath = path.join(config.outputDir, latestDir, frames[0]);
        }
      }
    } catch (e) {
      console.log('No test frames available, FPO will run without image evaluation');
    }
    
    // Prepare test data
    const testData = testFramePath ? {
      default: {
        path: testFramePath,
        reference: 'A sample scene from a video',
      },
    } : {};

    const results = [];
    
    for (let i = 1; i <= iterations; i++) {
      const result = await runFPOIteration(i, testData, {
        enableEvolution,
        evolutionInterval,
      });
      results.push(result);
    }

    const lastResult = results[results.length - 1];
    res.json({
      success: true,
      iterations: results.length,
      results,
      finalPrompt: lastResult.globalPrompt,
      evolved: lastResult.evolution ? lastResult.evolution.evolved.length : 0,
      generation: lastResult.evolution ? lastResult.evolution.generation : 0,
    });
  } catch (error) {
    console.error('FPO error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/fpo/status
 * Get current FPO status and prompt weights
 */
router.get('/fpo/status', (req, res) => {
  try {
    const prompts = loadPrompts();
    
    const status = {
      globalPrompt: prompts.global_prompt,
      populationSize: prompts.templates.length,
      maxGeneration: Math.max(...prompts.templates.map(t => t.generation || 0)),
      templates: prompts.templates
        .sort((a, b) => b.weight - a.weight)
        .map(t => ({
          id: t.id,
          name: t.name,
          template: t.template,
          weight: t.weight,
          generation: t.generation || 0,
          parents: t.parents || [],
          performanceHistory: t.performance,
          latestScore: t.performance[t.performance.length - 1]?.score,
        })),
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/scenes/:videoId
 * Get visual scene viewer for a video (HTML page)
 */
router.get('/scenes/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;
    const scenesPath = path.join(config.outputDir, `${videoId}_scenes.json`);
    
    if (!fs.existsSync(scenesPath)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Scenes Not Found</title>
          <style>
            body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1>Scenes Not Found</h1>
          <p>No scene detection found for video: <code>${videoId}</code></p>
          <p>Run scene detection first:</p>
          <pre>./scripts/detect-scenes.sh -f ${videoId}</pre>
        </body>
        </html>
      `);
    }

    const sceneData = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
    const videoPath = sceneData.videoPath || `uploads/${videoId}.mp4`;
    
    // Helper function for time formatting
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Generate HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scene Viewer - ${videoId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    .header p {
      opacity: 0.9;
      font-size: 0.9em;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .video-player {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .video-player h2 {
      margin-bottom: 15px;
      color: #667eea;
    }
    video {
      width: 100%;
      max-width: 800px;
      border-radius: 8px;
      background: #000;
    }
    .stats {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    .stat {
      background: #f8f9fa;
      padding: 15px 20px;
      border-radius: 8px;
      flex: 1;
      min-width: 150px;
    }
    .stat-label {
      font-size: 0.85em;
      color: #666;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 1.5em;
      font-weight: bold;
      color: #667eea;
    }
    .scenes-grid {
      display: grid;
      gap: 20px;
    }
    .scene {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .scene:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .scene-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 2px solid #f0f0f0;
    }
    .scene-title {
      font-size: 1.3em;
      font-weight: bold;
      color: #667eea;
    }
    .scene-time {
      font-size: 0.9em;
      color: #666;
      background: #f8f9fa;
      padding: 5px 12px;
      border-radius: 20px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .scene-time:hover {
      background: #667eea;
      color: white;
    }
    .scene-duration {
      font-size: 0.85em;
      color: #999;
      margin-left: 10px;
    }
    .frames-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 15px 0;
    }
    .frame {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      background: #f0f0f0;
    }
    .frame img {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.3s;
    }
    .frame:hover img {
      transform: scale(1.05);
    }
    .frame-label {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
      color: white;
      padding: 10px;
      font-size: 0.85em;
    }
    .description {
      margin-top: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      border-radius: 4px;
      font-size: 0.95em;
      line-height: 1.6;
      color: #555;
    }
    .no-frames {
      text-align: center;
      padding: 40px;
      color: #999;
      font-style: italic;
    }
    @media (max-width: 768px) {
      .frames-container {
        grid-template-columns: 1fr;
      }
      .stats {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎬 Scene Viewer</h1>
    <p>Video ID: ${videoId}</p>
  </div>

  <div class="container">
    <div class="video-player">
      <h2>📹 Video Playback</h2>
      <video id="videoPlayer" controls autoplay muted>
        <source src="/${videoPath}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Total Scenes</div>
          <div class="stat-value">${sceneData.sceneCount}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Detection Threshold</div>
          <div class="stat-value">${sceneData.threshold}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Detected</div>
          <div class="stat-value">${new Date(sceneData.timestamp).toLocaleDateString()}</div>
        </div>
      </div>
    </div>

    <div class="scenes-grid">
      ${sceneData.scenes.map(scene => `
        <div class="scene" id="scene-${scene.sceneId}">
          <div class="scene-header">
            <div>
              <span class="scene-title">Scene ${scene.sceneId}</span>
              <span class="scene-duration">(${scene.duration}s)</span>
            </div>
            <div class="scene-time" onclick="seekTo(${scene.start})">
              ${formatTime(scene.start)} → ${formatTime(scene.end)}
            </div>
          </div>

          ${scene.frames && scene.frames.length > 0 ? `
            <div class="frames-container">
              ${scene.frames.map((frame, idx) => `
                <div class="frame">
                  <img src="/${frame.relativePath}" alt="Frame ${frame.frameId}">
                  <div class="frame-label">
                    Frame ${frame.frameId} • ${formatTime(frame.timestamp)}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="no-frames">No frames extracted for this scene</div>
          `}

          ${scene.description ? `
            <div class="description">
              ${scene.description}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return mins + ':' + secs.toString().padStart(2, '0');
    }

    function seekTo(time) {
      const video = document.getElementById('videoPlayer');
      video.currentTime = time;
      video.play();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Auto-scroll to current scene
    const video = document.getElementById('videoPlayer');
    const scenes = ${JSON.stringify(sceneData.scenes)};
    
    video.addEventListener('timeupdate', () => {
      const currentTime = video.currentTime;
      const currentScene = scenes.find(s => currentTime >= s.start && currentTime < s.end);
      
      if (currentScene) {
        // Highlight current scene (optional)
        document.querySelectorAll('.scene').forEach(el => {
          el.style.border = '';
        });
        const sceneEl = document.getElementById('scene-' + currentScene.sceneId);
        if (sceneEl) {
          sceneEl.style.border = '3px solid #667eea';
        }
      }
    });
  </script>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Scenes viewer error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/scenes/:videoId/json
 * Get scene data as JSON
 */
router.get('/scenes/:videoId/json', (req, res) => {
  try {
    const { videoId } = req.params;
    const scenesPath = path.join(config.outputDir, `${videoId}_scenes.json`);
    
    if (!fs.existsSync(scenesPath)) {
      return res.status(404).json({ error: 'Scenes not found' });
    }

    const sceneData = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
    res.json(sceneData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
