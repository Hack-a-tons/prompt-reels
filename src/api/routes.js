const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { processVideo } = require('../core/videoProcessor');
const { describeImage } = require('../core/gemini');
const { loadPrompts, runFPOIteration } = require('../core/promptOptimizer');
const { logVideoAnalysis } = require('../core/weave');

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
    const { iterations = 3 } = req.body;
    
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
      const result = await runFPOIteration(i, testData);
      results.push(result);
    }

    res.json({
      success: true,
      iterations: results.length,
      results,
      finalPrompt: results[results.length - 1].globalPrompt,
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
      templates: prompts.templates.map(t => ({
        id: t.id,
        name: t.name,
        weight: t.weight,
        performanceHistory: t.performance,
        latestScore: t.performance[t.performance.length - 1]?.score,
      })),
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
