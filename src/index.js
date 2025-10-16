const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const routes = require('./api/routes');
const { initWeave } = require('./core/weave');
const { logMiddleware } = require('./utils/logger');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware (logs all API calls with timestamp, IP, request/response)
app.use(logMiddleware);

// Serve static files (videos and extracted frames)
app.use('/uploads', express.static(path.join(__dirname, '..', config.uploadDir)));
app.use('/output', express.static(path.join(__dirname, '..', config.outputDir)));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'prompt-reels',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      geminiModel: config.geminiModel,
      wandbProject: config.wandbProject,
      hasGeminiKey: !!config.googleApiKey,
      hasAzureKey: !!config.azureOpenAI.apiKey,
      hasWandbKey: !!config.wandbApiKey,
    },
  });
});

// API routes
app.use('/api', routes);

// Video Upload & Analysis page
app.get('/analyze', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Analysis - Prompt Reels</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            width: 100%;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            color: #666;
            font-size: 1.1em;
        }
        .upload-area {
            border: 3px dashed #667eea;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 30px;
            background: #f8f9ff;
        }
        .upload-area:hover {
            background: #eef1ff;
            border-color: #764ba2;
            transform: translateY(-2px);
        }
        .upload-area.dragging {
            background: #eef1ff;
            border-color: #764ba2;
            transform: scale(1.02);
        }
        .upload-icon {
            font-size: 4em;
            margin-bottom: 10px;
        }
        .upload-text {
            font-size: 1.2em;
            color: #333;
            margin-bottom: 5px;
        }
        .upload-hint {
            color: #666;
            font-size: 0.9em;
        }
        input[type="file"] {
            display: none;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 40px;
            border-radius: 50px;
            font-size: 1.1em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            width: 100%;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .progress-container {
            display: none;
            margin-top: 30px;
        }
        .progress-bar {
            background: #e0e0e0;
            border-radius: 10px;
            height: 20px;
            overflow: hidden;
            margin-bottom: 15px;
        }
        .progress-fill {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100%;
            width: 0%;
            transition: width 0.3s;
            border-radius: 10px;
        }
        .status {
            text-align: center;
            color: #666;
            font-size: 1em;
        }
        .status-step {
            margin: 10px 0;
            padding: 10px;
            border-radius: 8px;
            background: #f8f9ff;
        }
        .status-step.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: bold;
        }
        .status-step.complete {
            background: #10b981;
            color: white;
        }
        .file-info {
            display: none;
            margin-top: 20px;
            padding: 15px;
            background: #f8f9ff;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .file-info-item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 0.95em;
        }
        .file-info-label {
            color: #666;
        }
        .file-info-value {
            font-weight: bold;
            color: #333;
        }
        .error {
            display: none;
            margin-top: 20px;
            padding: 15px;
            background: #fee;
            border-radius: 8px;
            border-left: 4px solid #ef4444;
            color: #dc2626;
        }
        .back-link {
            display: block;
            text-align: center;
            margin-top: 20px;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .back-link:hover {
            text-decoration: underline;
        }
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Video Analysis</h1>
            <p class="subtitle">Upload a video to get AI-powered scene descriptions</p>
        </div>

        <div class="upload-area" id="uploadArea">
            <div class="upload-icon">📹</div>
            <div class="upload-text">Click to upload or drag and drop</div>
            <div class="upload-hint">MP4, MOV, AVI, MKV, WebM (max 200MB)</div>
            <input type="file" id="fileInput" accept="video/*">
        </div>

        <div style="text-align: center; margin: 20px 0; color: #71767b; font-size: 14px;">OR</div>

        <div style="max-width: 600px; margin: 0 auto 30px;">
            <label style="display: block; margin-bottom: 8px; color: #667eea; font-weight: 600;">Video URL</label>
            <input type="url" id="videoUrl" placeholder="https://example.com/video.mp4" 
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 15px;"
                   oninput="handleUrlInput()">
            <div style="font-size: 12px; color: #71767b; margin-top: 5px;">Paste a direct video URL to download instead of uploading</div>
        </div>

        <div style="max-width: 600px; margin: 0 auto 30px;">
            <label style="display: block; margin-bottom: 8px; color: #667eea; font-weight: 600;">Language (optional)</label>
            <input type="text" id="languageInput" placeholder="Auto-detect (or enter: English, Spanish, French, etc.)" 
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 15px;">
            <div style="font-size: 12px; color: #71767b; margin-top: 5px;">Leave empty to auto-detect from video transcription</div>
        </div>

        <div class="file-info" id="fileInfo">
            <div class="file-info-item">
                <span class="file-info-label">File:</span>
                <span class="file-info-value" id="fileName"></span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">Size:</span>
                <span class="file-info-value" id="fileSize"></span>
            </div>
        </div>

        <button class="btn" id="analyzeBtn" disabled onclick="analyzeVideo()">
            Analyze Video
        </button>

        <div class="error" id="error"></div>

        <div class="progress-container" id="progressContainer">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="status" id="status">
                <div class="status-step" id="step1">1. Uploading video...</div>
                <div class="status-step" id="step2">2. Detecting scenes...</div>
                <div class="status-step" id="step3">3. Extracting frames...</div>
                <div class="status-step" id="step4">4. Generating descriptions...</div>
            </div>
        </div>

        <a href="/videos" class="back-link">📹 My Videos</a>
        <span style="margin: 0 10px; color: #667eea;">|</span>
        <a href="/" class="back-link">← Dashboard</a>
    </div>

    <script>
        let selectedFile = null;
        let videoUrl = '';

        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const videoUrlInput = document.getElementById('videoUrl');
        const languageInput = document.getElementById('languageInput');
        const fileInfo = document.getElementById('fileInfo');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const progressContainer = document.getElementById('progressContainer');
        const errorDiv = document.getElementById('error');

        // Click to upload
        uploadArea.addEventListener('click', () => fileInput.click());

        // File selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFile(file);
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragging');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragging');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragging');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('video/')) {
                handleFile(file);
            } else {
                showError('Please drop a video file');
            }
        });

        function handleUrlInput() {
            videoUrl = videoUrlInput.value.trim();
            if (videoUrl) {
                // Clear file selection
                selectedFile = null;
                fileInput.value = '';
                fileInfo.style.display = 'none';
                uploadArea.querySelector('.upload-text').textContent = 'Click to upload or drag and drop';
                uploadArea.querySelector('.upload-icon').textContent = '📹';
                
                // Enable analyze button
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = 'Download & Analyze Video';
                
                // Hide error
                errorDiv.style.display = 'none';
            } else {
                analyzeBtn.textContent = 'Analyze Video';
                if (!selectedFile) {
                    analyzeBtn.disabled = true;
                }
            }
        }

        function handleFile(file) {
            selectedFile = file;
            
            // Clear URL input
            videoUrl = '';
            videoUrlInput.value = '';
            
            // Show file info
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = formatFileSize(file.size);
            fileInfo.style.display = 'block';
            
            // Enable analyze button
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Video';
            
            // Update upload area text
            uploadArea.querySelector('.upload-text').textContent = '✓ Video selected';
            uploadArea.querySelector('.upload-icon').textContent = '✅';
            
            // Hide error
            errorDiv.style.display = 'none';
        }

        function formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }

        async function analyzeVideo() {
            // Check if we have either a file or URL
            if (!selectedFile && !videoUrl) {
                showError('Please select a video file or enter a video URL');
                return;
            }

            // Check file size if uploading (200MB limit)
            if (selectedFile && selectedFile.size > 200 * 1024 * 1024) {
                showError('File too large. Maximum size is 200MB.');
                return;
            }

            // Disable button and show progress
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<span class="spinner"></span>Starting...';
            progressContainer.style.display = 'block';
            errorDiv.style.display = 'none';

            try {
                let videoId;
                
                if (videoUrl) {
                    // Step 1: Download video from URL
                    updateProgress(0, 1, 'Downloading from URL...');
                    const downloadResult = await downloadVideoFromUrl(videoUrl);
                    videoId = downloadResult.videoId;
                    updateProgress(25, 1, 'Download complete');
                } else {
                    // Step 1: Upload video
                    updateProgress(0, 1, 'Uploading 0%');
                    const uploadResult = await uploadVideo(selectedFile);
                    videoId = uploadResult.videoId;
                }

                // Get language preference
                const language = languageInput.value.trim() || null;

                // Step 2: Detect scenes with frames extraction and descriptions
                updateProgress(25, 2, 'Detecting scenes...');
                
                // Start progress animation while waiting for server response
                let progressPercent = 25;
                const progressInterval = setInterval(() => {
                    if (progressPercent < 95) {
                        progressPercent += 2;
                        const step = progressPercent < 40 ? 2 : progressPercent < 70 ? 3 : 4;
                        const message = progressPercent < 40 ? 'Detecting scenes...' : 
                                      progressPercent < 60 ? 'Extracting frames...' : 
                                      'Generating descriptions...';
                        updateProgress(progressPercent, step, message);
                    }
                }, 2000); // Update every 2 seconds
                
                try {
                    const sceneResult = await detectScenes(videoId, language);
                    clearInterval(progressInterval);
                    
                    // Complete
                    updateProgress(100, 4, 'Complete!');
                } catch (error) {
                    clearInterval(progressInterval);
                    throw error;
                }

                // Redirect to scene viewer
                setTimeout(() => {
                    window.location.href = '/api/scenes/' + videoId;
                }, 1000);

            } catch (error) {
                showError(error.message || 'Analysis failed. Please try again.');
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = videoUrl ? 'Download & Analyze Video' : 'Analyze Video';
                progressContainer.style.display = 'none';
            }
        }

        async function downloadVideoFromUrl(url) {
            const response = await fetch('/api/download-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to download video from URL');
            }

            return response.json();
        }

        async function uploadVideo(file) {
            const maxRetries = 8;
            const retryDelay = 5000; // Start with 5 seconds
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const formData = new FormData();
                    formData.append('video', file);

                    const result = await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        
                        // Track upload progress
                        xhr.upload.addEventListener('progress', (e) => {
                            if (e.lengthComputable) {
                                const percentComplete = (e.loaded / e.total) * 100;
                                const uploadPercent = Math.min(25, percentComplete * 0.25); // Upload is first 25% of total progress
                                updateProgress(uploadPercent, 1, 'Uploading ' + percentComplete.toFixed(1) + '%');
                            }
                        });
                        
                        xhr.addEventListener('load', () => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                try {
                                    const response = JSON.parse(xhr.responseText);
                                    resolve(response);
                                } catch (error) {
                                    reject(new Error('Invalid response from server'));
                                }
                            } else {
                                try {
                                    const error = JSON.parse(xhr.responseText);
                                    reject(new Error(error.error || 'Upload failed'));
                                } catch {
                                    reject(new Error('Upload failed'));
                                }
                            }
                        });
                        
                        xhr.addEventListener('error', () => {
                            reject(new Error('Network error during upload'));
                        });
                        
                        xhr.addEventListener('abort', () => {
                            reject(new Error('Upload cancelled'));
                        });
                        
                        // Set timeout for detecting stalled connections
                        xhr.timeout = 300000; // 5 minutes timeout for large files and network switches
                        xhr.addEventListener('timeout', () => {
                            reject(new Error('Upload timeout - connection may be lost'));
                        });
                        
                        xhr.open('POST', '/api/upload');
                        xhr.send(formData);
                    });
                    
                    // Success - return result
                    return result;
                    
                } catch (error) {
                    // Check if it's a network error that we should retry
                    const isNetworkError = error.message.includes('Network error') || 
                                         error.message.includes('timeout');
                    
                    if (isNetworkError && attempt < maxRetries - 1) {
                        // Calculate exponential backoff with max cap
                        const waitTime = Math.min(retryDelay * Math.pow(2, attempt), 60000); // Cap at 60 seconds
                        
                        // Show retry message
                        showError('Connection lost (network switch or timeout). Waiting ' + (waitTime/1000) + ' seconds to reconnect... (Attempt ' + (attempt + 1) + '/' + maxRetries + ')');
                        
                        // Wait before retrying
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        
                        // Clear error and continue to next attempt
                        errorDiv.style.display = 'none';
                        continue;
                    }
                    
                    // If it's not a network error or we've exhausted retries, throw
                    throw error;
                }
            }
            
            // If we get here, all retries failed
            throw new Error('Upload failed after multiple attempts. Please check your connection and try again.');
        }

        async function detectScenes(videoId, language) {
            const response = await fetch('/api/detect-scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId,
                    threshold: 0.4,
                    extractFrames: true,
                    describeScenes: true,
                    transcribeAudio: true,
                    language: language
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Scene detection failed');
            }

            return response.json();
        }

        function updateProgress(percent, step, message) {
            document.getElementById('progressFill').style.width = percent + '%';
            
            // Update button text if message provided
            if (message) {
                analyzeBtn.innerHTML = '<span class="spinner"></span>' + message;
            }
            
            // Update step status
            for (let i = 1; i <= 4; i++) {
                const stepEl = document.getElementById('step' + i);
                stepEl.classList.remove('active', 'complete');
                if (i < step) {
                    stepEl.classList.add('complete');
                } else if (i === step) {
                    stepEl.classList.add('active');
                }
            }
        }

        function showError(message) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// Videos listing page
app.get('/videos', (req, res) => {
  const outputDir = require('./config').outputDir;
  
  // Get all scene files for user uploads (video-*)
  const videos = [];
  if (fs.existsSync(outputDir)) {
    const sceneFiles = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('video-') && f.endsWith('_scenes.json'));
    
    for (const file of sceneFiles) {
      try {
        const scenePath = path.join(outputDir, file);
        const sceneData = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
        
        videos.push({
          videoId: sceneData.videoId,
          sceneCount: sceneData.sceneCount,
          threshold: sceneData.threshold,
          timestamp: sceneData.timestamp,
          hasScenes: sceneData.scenes && sceneData.scenes.length > 0,
          hasDescriptions: sceneData.scenes && sceneData.scenes.some(s => s.description),
          hasTranscripts: sceneData.scenes && sceneData.scenes.some(s => s.transcript),
        });
      } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
      }
    }
  }
  
  // Sort by timestamp, newest first
  videos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uploaded Videos - Prompt Reels</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419;
            color: #e7e9ea;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 15px;
        }
        h1 { font-size: 32px; margin: 0; }
        .nav-buttons {
            display: flex;
            gap: 15px;
        }
        .btn {
            background: #1d9bf0;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 9999px;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover {
            background: #1a8cd8;
        }
        .btn.secondary {
            background: #2f3336;
        }
        .btn.secondary:hover {
            background: #3a3f44;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 20px;
        }
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            color: #1d9bf0;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #71767b;
            font-size: 14px;
        }
        .empty {
            text-align: center;
            padding: 60px 20px;
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
        }
        .empty h2 {
            color: #71767b;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: #16181c;
            border-radius: 12px;
            overflow: hidden;
        }
        th, td {
            padding: 16px;
            text-align: left;
            border-bottom: 1px solid #2f3336;
        }
        th {
            background: #1d1f23;
            color: #71767b;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
        }
        tr:hover {
            background: #1a1c1f;
        }
        .video-id {
            color: #1d9bf0;
            text-decoration: none;
            font-weight: 600;
        }
        .video-id:hover {
            text-decoration: underline;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge.yes {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
        }
        .badge.no {
            background: rgba(113, 118, 123, 0.2);
            color: #71767b;
        }
        .video-preview {
            width: 160px;
            height: 90px;
            border-radius: 6px;
            background: #0f1419;
        }
        .no-video {
            width: 160px;
            height: 90px;
            background: #2f3336;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #71767b;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📹 Uploaded Videos</h1>
            <div class="nav-buttons">
                <a href="/analyze" class="btn">+ Upload New Video</a>
                <a href="/" class="btn secondary">← Articles Dashboard</a>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${videos.length}</div>
                <div class="stat-label">Total Videos</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${videos.filter(v => v.hasDescriptions).length}</div>
                <div class="stat-label">With Descriptions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${videos.filter(v => v.hasTranscripts).length}</div>
                <div class="stat-label">With Transcripts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${videos.reduce((sum, v) => sum + v.sceneCount, 0)}</div>
                <div class="stat-label">Total Scenes</div>
            </div>
        </div>
        
        ${videos.length === 0 ? `
        <div class="empty">
            <h2>No videos uploaded yet</h2>
            <p style="color: #71767b; margin-bottom: 20px;">Upload your first video to get started</p>
            <a href="/analyze" class="btn">Upload Video</a>
        </div>
        ` : `
        <table>
            <thead>
                <tr>
                    <th>Preview</th>
                    <th>Video ID</th>
                    <th>Scenes</th>
                    <th>Descriptions</th>
                    <th>Transcripts</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${videos.map(video => {
                    // Get video thumbnail preview
                    const thumbnailPath = `/api/thumbnails/${video.videoId}.mp4`;
                    const videoHtml = `<video class="video-preview" autoplay muted loop playsinline><source src="${thumbnailPath}" type="video/mp4" onerror="this.parentElement.outerHTML='<div class=\"no-video\">No preview</div>'"></video>`;
                    
                    return `
                <tr>
                    <td>${videoHtml}</td>
                    <td><a href="/api/scenes/${video.videoId}" class="video-id">${video.videoId}</a></td>
                    <td>${video.sceneCount}</td>
                    <td><span class="badge ${video.hasDescriptions ? 'yes' : 'no'}">${video.hasDescriptions ? 'Yes' : 'No'}</span></td>
                    <td><span class="badge ${video.hasTranscripts ? 'yes' : 'no'}">${video.hasTranscripts ? 'Yes' : 'No'}</span></td>
                    <td>${new Date(video.timestamp).toLocaleString()}</td>
                    <td><a href="/api/scenes/${video.videoId}" class="btn" style="padding: 6px 16px; font-size: 13px;">View</a></td>
                </tr>
                `;
                }).join('')}
            </tbody>
        </table>
        `}
    </div>
    
    <script>
        // Auto-play videos when they come into view
        document.addEventListener('DOMContentLoaded', () => {
            const videos = document.querySelectorAll('.video-preview');
            
            // Try to play all videos immediately
            videos.forEach(video => {
                video.play().catch(() => {
                    // Autoplay failed, use intersection observer
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                entry.target.play().catch(() => {});
                            } else {
                                entry.target.pause();
                            }
                        });
                    }, { threshold: 0.5 });
                    
                    observer.observe(video);
                });
            });
        });
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// Dashboard HTML page
app.get('/', (req, res) => {
  const { listArticles } = require('./core/articleWorkflow');
  const allArticles = listArticles();
  
  // Filter to only show articles with local videos
  const articles = allArticles.filter(article => article.hasLocalVideo);
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Reels - Article Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419;
            color: #e7e9ea;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }
        h1 { font-size: 32px; margin: 0; }
        .add-articles-btn {
            background: #1d9bf0;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 9999px;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }
        .add-articles-btn:hover:not(:disabled) {
            background: #1a8cd8;
        }
        .add-articles-btn:disabled {
            background: #2f3336;
            color: #71767b;
            cursor: not-allowed;
        }
        .add-articles-btn .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 20px;
        }
        .stat-number { font-size: 32px; font-weight: bold; color: #1d9bf0; }
        .stat-label { color: #71767b; margin-top: 5px; }
        table {
            width: 100%;
            border-collapse: collapse;
            background: #16181c;
            border-radius: 12px;
            overflow: hidden;
        }
        th, td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #2f3336;
        }
        .video-preview {
            width: 160px;
            height: 90px;
            border-radius: 6px;
            background: #0f1419;
        }
        .no-video {
            width: 160px;
            height: 90px;
            background: #2f3336;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #71767b;
            font-size: 12px;
        }
        th { background: #1c1f23; color: #71767b; font-weight: 600; font-size: 13px; text-transform: uppercase; }
        tr:hover { background: #1c1f23; }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .status-fetched { background: #1d4ed8; color: #dbeafe; }
        .status-described { background: #7c3aed; color: #ede9fe; }
        .status-rated { background: #059669; color: #d1fae5; }
        .status-error { background: #dc2626; color: #fee2e2; }
        .video-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            background: #2f3336;
            color: #71767b;
        }
        .video-badge.local { background: #15803d; color: #d1fae5; }
        .title {
            font-size: 16px;
            font-weight: 500;
            max-width: 400px;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .title a { color: #e7e9ea; text-decoration: none; }
        .title a:hover { color: #1d9bf0; text-decoration: underline; }
        .actions { display: flex; gap: 10px; }
        .btn {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            border: 1px solid #2f3336;
            background: #16181c;
            color: #e7e9ea;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover { background: #1c1f23; border-color: #1d9bf0; }
        .empty {
            text-align: center;
            padding: 60px 20px;
            color: #71767b;
        }
        .score {
            font-weight: bold;
        }
        .score.high { color: #10b981; }
        .score.medium { color: #f59e0b; }
        .score.low { color: #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Prompt Reels - Article Dashboard</h1>
            <div style="display: flex; gap: 15px; align-items: center;">
                <a href="/videos" class="add-articles-btn" style="text-decoration: none; background: #2f3336;">📹 My Videos</a>
                <a href="/analyze" class="add-articles-btn" style="text-decoration: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">➕ Upload Video</a>
                <a href="/prompts" class="add-articles-btn" style="text-decoration: none; background: #2f3336;">🧠 View Prompts</a>
                <button id="addArticlesBtn" class="add-articles-btn" onclick="addArticles()" style="display: none;">
                    + Add 10 Articles
                </button>
                <span id="addingStatus" style="display: none; color: #71767b; font-size: 14px;">
                    <span class="spinner" style="width: 14px; height: 14px;"></span> Adding articles...
                </span>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${articles.length}</div>
                <div class="stat-label">Total Articles</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${articles.filter(a => a.status === 'fetched').length}</div>
                <div class="stat-label">Fetched</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${articles.filter(a => a.status === 'described').length}</div>
                <div class="stat-label">Described</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${articles.filter(a => a.status === 'rated').length}</div>
                <div class="stat-label">Rated</div>
            </div>
        </div>
        
        ${articles.length === 0 ? `
        <div class="empty">
            <h2>No articles yet</h2>
            <p>Fetch your first article with:</p>
            <p><code>./scripts/fetch-news.sh</code></p>
        </div>
        ` : `
        <table>
            <thead>
                <tr>
                    <th>Preview</th>
                    <th>Article</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Video</th>
                    <th>Scenes</th>
                    <th>Score</th>
                    <th>Fetched</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${articles.map(article => {
                    // Get video player for preview (use thumbnail for dashboard)
                    let videoHtml = '<div class="no-video">No video</div>';
                    if (article.hasLocalVideo) {
                        const thumbnailPath = `/api/thumbnails/${article.articleId}.mp4`;
                        videoHtml = `<video class="video-preview" autoplay muted loop playsinline><source src="${thumbnailPath}" type="video/mp4"></video>`;
                    }
                    
                    // Score coloring: high (>70) = green, medium (40-70) = yellow, low (<40) = red
                    let scoreClass = 'high';
                    if (article.matchScore) {
                        if (article.matchScore < 40) scoreClass = 'low';
                        else if (article.matchScore < 70) scoreClass = 'medium';
                    }
                    
                    return `
                <tr>
                    <td>${videoHtml}</td>
                    <td>
                        <div class="title">
                            <a href="/articles/${article.articleId}">${article.title}</a>
                        </div>
                    </td>
                    <td>${article.source.domain}</td>
                    <td><span class="status status-${article.status}">${article.status}</span></td>
                    <td>
                        <span class="video-badge ${article.hasLocalVideo ? 'local' : ''}">${article.videoType}</span>
                        ${article.hasLocalVideo ? ' ✓' : ''}
                    </td>
                    <td>${article.sceneCount || '-'}</td>
                    <td>${article.matchScore ? `<span class="score ${scoreClass}">${article.matchScore}</span>` : '-'}</td>
                    <td>${new Date(article.fetchedAt).toLocaleString()}</td>
                    <td class="actions">
                        ${article.status === 'fetched' && article.hasLocalVideo ? 
                            `<button class="btn" onclick="describeArticle('${article.articleId}')">Describe</button>` : ''}
                        ${article.status === 'described' ? 
                            `<a href="/api/scenes/${article.articleId}" class="btn" target="_blank">View Scenes</a>
                             <button class="btn" onclick="rateArticle('${article.articleId}')">Rate</button>` : ''}
                        ${article.status === 'rated' ? 
                            `<a href="/api/scenes/${article.articleId}" class="btn" target="_blank">View Scenes</a>` : ''}
                    </td>
                </tr>
                `;
                }).join('')}
            </tbody>
        </table>
        `}
    </div>
    
    <script>
        // Check flag status and update UI
        async function checkFlagStatus() {
            try {
                const res = await fetch('/api/flags/status');
                const data = await res.json();
                
                const btn = document.getElementById('addArticlesBtn');
                const status = document.getElementById('addingStatus');
                
                if (data.batchAdding) {
                    btn.style.display = 'none';
                    status.style.display = 'flex';
                } else {
                    btn.style.display = 'inline-block';
                    status.style.display = 'none';
                }
            } catch (err) {
                console.error('Error checking flags:', err);
            }
        }
        
        // Check on page load
        checkFlagStatus();
        
        // Check every 3 seconds
        setInterval(checkFlagStatus, 3000);
        
        async function describeArticle(articleId) {
            if (!confirm('Describe scenes for this article? This may take a few minutes.')) return;
            
            try {
                const res = await fetch(\`/api/articles/\${articleId}/describe\`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(\`Success! Found \${data.sceneCount} scenes.\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
        
        async function rateArticle(articleId) {
            if (!confirm('Rate video-article match? This uses AI to analyze.')) return;
            
            try {
                const res = await fetch(\`/api/articles/\${articleId}/rate\`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(\`Rated: \${data.matchScore}/100\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
        
        let isAddingArticles = false;
        
        async function addArticles() {
            if (isAddingArticles) {
                alert('Already adding articles, please wait...');
                return;
            }
            
            const btn = document.getElementById('addArticlesBtn');
            const status = document.getElementById('addingStatus');
            
            // Hide button immediately
            btn.style.display = 'none';
            status.style.display = 'flex';
            
            isAddingArticles = true;
            
            // Auto-refresh every 3 seconds to show progress
            const refreshInterval = setInterval(() => {
                const currentCount = document.querySelectorAll('tbody tr').length;
                fetch('/api/dashboard')
                    .then(r => r.json())
                    .then(d => {
                        if (d.count > currentCount) {
                            location.reload();
                        }
                    });
            }, 3000);
            
            try {
                const res = await fetch('/api/articles/batch-add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: 10 })
                });
                
                clearInterval(refreshInterval);
                const data = await res.json();
                
                if (data.success) {
                    alert(\`Success! Added \${data.added} new articles (checked \${data.attempts} total)\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                    // Show button again on error
                    btn.style.display = 'inline-block';
                    status.style.display = 'none';
                    isAddingArticles = false;
                }
            } catch (err) {
                clearInterval(refreshInterval);
                // Don't show error if it's just a timeout - articles are still being added
                console.log('Batch add in progress, page will auto-refresh...');
                // Keep button disabled and keep refreshing
            }
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// Article detail HTML page
app.get('/articles/:articleId', (req, res) => {
  const { getArticleDetails } = require('./core/articleWorkflow');
  const { articleId } = req.params;
  const article = getArticleDetails(articleId);
  
  if (!article) {
    return res.status(404).send('<h1>Article not found</h1>');
  }
  
  // Use streaming endpoint for local videos (supports range requests)
  const videoUrl = article.video.localPath 
    ? `/api/articles/${articleId}.mp4`
    : article.video.url;
  
  const hasLocalVideo = !!article.video.localPath;
  
  // Escape HTML for safe inclusion in JavaScript string
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  };
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} - Prompt Reels</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419;
            color: #e7e9ea;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .back-link {
            display: inline-block;
            color: #1d9bf0;
            text-decoration: none;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .back-link:hover { text-decoration: underline; }
        .article-header {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        .status-fetched { background: #1d4ed8; color: #dbeafe; }
        .status-described { background: #7c3aed; color: #ede9fe; }
        .status-rated { background: #059669; color: #d1fae5; }
        h1 { font-size: 32px; margin-bottom: 15px; }
        .meta {
            display: flex;
            gap: 20px;
            color: #71767b;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .video-container {
            background: #000;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 20px;
            position: relative;
        }
        video {
            width: 100%;
            max-height: 600px;
            display: block;
        }
        .no-video {
            padding: 60px;
            text-align: center;
            background: #16181c;
            border: 2px dashed #2f3336;
            border-radius: 12px;
            color: #71767b;
        }
        .content-section {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
        }
        .content-section h2 {
            font-size: 20px;
            margin-bottom: 15px;
            color: #1d9bf0;
        }
        .description {
            color: #e7e9ea;
            line-height: 1.8;
        }
        .description h1 {
            font-size: 28px;
            margin: 25px 0 15px 0;
            color: #e7e9ea;
        }
        .description h2 {
            font-size: 22px;
            margin: 20px 0 12px 0;
            color: #1d9bf0;
        }
        .description h3 {
            font-size: 18px;
            margin: 18px 0 10px 0;
            color: #71767b;
            font-weight: 600;
        }
        .description p {
            margin-bottom: 15px;
        }
        .description ul, .description ol {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .description li {
            margin-bottom: 8px;
        }
        .description code {
            background: #1c1f23;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        .description strong {
            color: #1d9bf0;
            font-weight: 600;
        }
        .description a {
            color: #1d9bf0;
            text-decoration: none;
        }
        .description a:hover {
            text-decoration: underline;
        }
        .video-link {
            display: block;
            margin-top: 10px;
            color: #71767b;
            font-size: 14px;
            text-decoration: none;
        }
        .video-link:hover {
            color: #1d9bf0;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .info-card {
            background: #1c1f23;
            padding: 15px;
            border-radius: 8px;
        }
        .info-label {
            color: #71767b;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .info-value {
            color: #e7e9ea;
            font-size: 16px;
            font-weight: 600;
        }
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        .btn {
            padding: 10px 20px;
            border-radius: 8px;
            border: 1px solid #2f3336;
            background: #1d9bf0;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover { background: #1a8cd8; }
        .btn-secondary {
            background: #16181c;
            color: #e7e9ea;
        }
        .btn-secondary:hover { background: #1c1f23; border-color: #1d9bf0; }
        .scenes-link {
            color: #1d9bf0;
            text-decoration: none;
            font-weight: 600;
        }
        .scenes-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-link">← Back to Dashboard</a>
        
        <div class="article-header">
            <span class="status-badge status-${article.workflow.status}">${article.workflow.status}</span>
            <h1>${article.title}</h1>
            <div class="meta">
                <span>📰 ${article.source.domain}</span>
                <span>📅 ${new Date(article.fetchedAt).toLocaleString()}</span>
                ${article.workflow.matchScore ? `<span>⭐ Score: ${article.workflow.matchScore}/100</span>` : ''}
                ${article.workflow.sceneCount ? `<span><a href="/api/scenes/${article.articleId}" style="color: #1d9bf0; text-decoration: none;">🎬 View ${article.workflow.sceneCount} Scene${article.workflow.sceneCount > 1 ? 's' : ''}</a></span>` : ''}
            </div>
        </div>
        
        ${hasLocalVideo ? `
        <div class="video-container">
            <video controls autoplay muted playsinline>
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
        <a href="${videoUrl}" class="video-link" target="_blank">🔗 Direct video link: ${videoUrl}</a>
        ` : `
        <div class="no-video">
            <h2>📹 Video Not Downloaded</h2>
            <p>This article has an embedded video that wasn't downloaded.</p>
            <p style="margin-top: 10px; color: #71767b;">Type: ${article.video.type} | Platform: ${article.video.platform || 'N/A'}</p>
            ${article.video.url ? `<p style="margin-top: 10px;"><a href="${article.video.url}" target="_blank" style="color: #1d9bf0;">View original video</a></p>` : ''}
        </div>
        `}
        
        <div class="info-grid">
            <div class="info-card">
                <div class="info-label">Status</div>
                <div class="info-value">${article.workflow.status}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Video Type</div>
                <div class="info-value">${article.video.type}</div>
            </div>
            ${article.workflow.sceneCount ? `
            <div class="info-card">
                <div class="info-label">Scenes</div>
                <div class="info-value">${article.workflow.sceneCount}</div>
            </div>
            ` : ''}
            ${article.workflow.matchScore ? `
            <div class="info-card">
                <div class="info-label">Match Score</div>
                <div class="info-value">${article.workflow.matchScore}/100</div>
            </div>
            ` : ''}
        </div>
        
        ${article.description ? `
        <div class="content-section">
            <h2>Description</h2>
            <div class="description" id="description-content"></div>
        </div>
        ` : ''}
        
        ${article.text && article.text !== article.description ? `
        <div class="content-section">
            <h2>Full Article Text</h2>
            <div class="description" id="text-content"></div>
        </div>
        ` : ''}
        
        <div class="content-section">
            <h2>Actions</h2>
            <div class="actions">
                ${article.workflow.status === 'fetched' && hasLocalVideo ? `
                    <button class="btn" onclick="describeArticle()">Describe Scenes</button>
                ` : ''}
                ${article.workflow.status === 'described' ? `
                    <a href="/api/scenes/${article.articleId}" class="btn" target="_blank">View Scenes</a>
                    <button id="rateBtn" class="btn" onclick="rateArticle()">Rate Match</button>
                    <span id="ratingStatus" style="display: none; color: #71767b; font-size: 13px; margin-left: 10px;">
                        <span class="spinner" style="width: 12px; height: 12px;"></span> Rating...
                    </span>
                ` : ''}
                ${article.workflow.status === 'rated' ? `
                    <a href="/api/scenes/${article.articleId}" class="btn" target="_blank">View Scenes</a>
                ` : ''}
                <a href="${article.source.url}" class="btn btn-secondary" target="_blank">View Original Article</a>
                <a href="/api/articles/${article.articleId}" class="btn btn-secondary" target="_blank">View JSON</a>
            </div>
        </div>
        
        ${article.sceneData ? `
        <div class="content-section">
            <h2>Scene Analysis</h2>
            <p>This article has been analyzed. <a href="/api/scenes/${article.articleId}" class="scenes-link">View detailed scene descriptions →</a></p>
        </div>
        ` : ''}
    </div>
    
    <script>
        // Render markdown content
        const descriptionEl = document.getElementById('description-content');
        const textEl = document.getElementById('text-content');
        
        if (descriptionEl) {
            const description = '${escapeHtml(article.description)}';
            descriptionEl.innerHTML = marked.parse(description);
        }
        
        if (textEl) {
            const text = '${escapeHtml(article.text.substring(0, 2000))}';
            textEl.innerHTML = marked.parse(text) + ${article.text.length > 2000 ? '"..."' : '""'};
        }
        
        // Check if rating is in progress (for described articles)
        const rateBtn = document.getElementById('rateBtn');
        const ratingStatus = document.getElementById('ratingStatus');
        
        if (rateBtn && ratingStatus) {
            async function checkRatingStatus() {
                try {
                    const res = await fetch('/api/flags/status');
                    const data = await res.json();
                    
                    // Check if this specific article is being rated
                    const isRating = data.batchAddingData || false; // Simplified check
                    
                    if (isRating) {
                        rateBtn.style.display = 'none';
                        ratingStatus.style.display = 'inline-flex';
                    } else {
                        rateBtn.style.display = 'inline-block';
                        ratingStatus.style.display = 'none';
                    }
                } catch (err) {
                    console.error('Error checking rating status:', err);
                }
            }
            
            checkRatingStatus();
            setInterval(checkRatingStatus, 3000);
        }
        
        async function describeArticle() {
            if (!confirm('Describe scenes for this article? This may take a few minutes.')) return;
            
            try {
                const res = await fetch('/api/articles/${article.articleId}/describe', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(\`Success! Found \${data.sceneCount} scenes.\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
        
        async function rateArticle() {
            if (!confirm('Rate video-article match? This uses AI to analyze.')) return;
            
            // Hide button immediately
            const rateBtn = document.getElementById('rateBtn');
            const ratingStatus = document.getElementById('ratingStatus');
            if (rateBtn && ratingStatus) {
                rateBtn.style.display = 'none';
                ratingStatus.style.display = 'inline-flex';
            }
            
            try {
                const res = await fetch('/api/articles/${article.articleId}/rate', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(\`Rated: \${data.matchScore}/100\`);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                    // Show button again on error
                    if (rateBtn && ratingStatus) {
                        rateBtn.style.display = 'inline-block';
                        ratingStatus.style.display = 'none';
                    }
                }
            } catch (err) {
                alert('Error: ' + err.message);
                // Show button again on error
                if (rateBtn && ratingStatus) {
                    rateBtn.style.display = 'inline-block';
                    ratingStatus.style.display = 'none';
                }
            }
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// Prompts viewer page
app.get('/prompts', (req, res) => {
  const { loadPrompts } = require('./core/promptOptimizer');
  
  try {
    const prompts = loadPrompts();
    
    // Handle old format: prompts.templates array
    // Convert to versions format for display
    const templates = prompts.templates || [];
    
    // Group templates into two categories for display
    const sceneVersions = templates.map((t, index) => ({
      id: t.id,
      version: `1.${index}`,
      name: t.name,
      template: t.template,
      generation: t.generation || 0,
      performance: {
        avgScore: t.performance && t.performance.length > 0 
          ? t.performance.reduce((sum, p) => sum + p.score, 0) / t.performance.length 
          : null,
        weight: t.weight || 0,
        samples: t.performance ? t.performance.length : 0
      },
      createdAt: t.createdAt || new Date().toISOString(),
      isActive: index === 0
    }));
    
    // Sort: tested first (by weight - the actual optimization metric), then untested
    const testedVersions = sceneVersions.filter(v => v.performance.samples > 0)
      .sort((a, b) => (b.performance.weight || 0) - (a.performance.weight || 0));
    const untestedVersions = sceneVersions.filter(v => v.performance.samples === 0);
    
    // Same prompts are used for both scene description and video-article match
    // They're evaluated on the same data during FPO
    const matchVersions = sceneVersions.map(v => ({
      ...v,
      // Mark these as match prompts for display
      type: 'match'
    }));
    
    // Sort match versions the same way (by weight)
    const testedMatchVersions = matchVersions.filter(v => v.performance.samples > 0)
      .sort((a, b) => (b.performance.weight || 0) - (a.performance.weight || 0));
    const untestedMatchVersions = matchVersions.filter(v => v.performance.samples === 0);
    
    // Combine tested and untested
    const sortedSceneVersions = [...testedVersions, ...untestedVersions];
    const sortedMatchVersions = [...testedMatchVersions, ...untestedMatchVersions];
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Optimization History - Prompt Reels</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419;
            color: #e7e9ea;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }
        h1 { font-size: 32px; }
        .back-link {
            color: #1d9bf0;
            text-decoration: none;
            font-size: 16px;
        }
        .back-link:hover { text-decoration: underline; }
        
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            border-bottom: 1px solid #2f3336;
        }
        .tab {
            padding: 15px 25px;
            cursor: pointer;
            background: transparent;
            border: none;
            color: #71767b;
            font-size: 16px;
            font-weight: 500;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
        }
        .tab:hover { color: #e7e9ea; }
        .tab.active {
            color: #1d9bf0;
            border-bottom-color: #1d9bf0;
        }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        .prompt-card {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            position: relative;
        }
        .prompt-card.best {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.05);
        }
        .prompt-card.current {
            border-color: #1d9bf0;
        }
        
        .badge {
            position: absolute;
            top: 15px;
            right: 15px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge.best {
            background: #10b981;
            color: white;
        }
        .badge.current {
            background: #1d9bf0;
            color: white;
        }
        
        .prompt-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 15px;
        }
        .prompt-version {
            font-size: 24px;
            font-weight: bold;
            color: #e7e9ea;
        }
        .prompt-score {
            font-size: 32px;
            font-weight: bold;
            color: #10b981;
        }
        .prompt-score.low { color: #f59e0b; }
        .prompt-score.poor { color: #ef4444; }
        
        .prompt-stats {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            font-size: 14px;
            color: #71767b;
        }
        .stat {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .prompt-text {
            background: #0f1419;
            border: 1px solid #2f3336;
            border-radius: 8px;
            padding: 15px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            color: #e7e9ea;
        }
        
        .improvement {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            margin-left: 10px;
            font-size: 14px;
            font-weight: 600;
        }
        .improvement.positive { color: #10b981; }
        .improvement.negative { color: #ef4444; }
        
        .info-box {
            background: rgba(29, 155, 240, 0.1);
            border: 1px solid rgba(29, 155, 240, 0.3);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .info-box h3 {
            color: #1d9bf0;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .info-box p {
            color: #e7e9ea;
            line-height: 1.6;
        }
        
        .empty {
            text-align: center;
            padding: 60px 20px;
            color: #71767b;
        }
        .empty h2 {
            font-size: 24px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h1>🧠 Prompt Optimization History</h1>
                <a href="/" class="back-link" style="position: static; margin-top: 10px; display: inline-block;">← Back to Dashboard</a>
            </div>
            <div style="display: flex; gap: 15px; align-items: center;">
                <button id="runFpoBtn" class="add-articles-btn" onclick="runFPO()" style="background: #7c3aed; font-size: 16px; padding: 12px 24px;">
                    🚀 Run FPO Iteration
                </button>
                <span id="fpoStatus" style="display: none; color: #71767b; font-size: 14px;">
                    <span class="spinner" style="width: 14px; height: 14px;"></span> Running FPO...
                </span>
            </div>
        </div>
        
        <div class="info-box">
            <h3>How Prompt Ranking Works</h3>
            <p><strong>Score = Semantic Similarity</strong> between AI output and ground truth (0-1 scale, shown as 0-100).</p>
            <p style="margin-top: 10px;">
                <strong>Same Prompts, Different Tasks:</strong> The prompts below are used for both scene description and video-article matching. During FPO evaluation, each prompt is tested on actual article data (video frames + article text) to measure how well it performs at generating accurate descriptions and match ratings.
            </p>
            <p style="margin-top: 10px;">
                <strong>Scene Description:</strong> AI describes what's happening in video frames. Compared to article text via semantic similarity.<br>
                <strong>Video-Article Match:</strong> AI rates how well video matches article content (0-100 score).
            </p>
            <p style="margin-top: 10px;">
                Prompts are sorted <strong>best to worst</strong> by <strong>weight</strong> (Thompson Sampling optimization metric). 
                Weight balances performance and sample size - more reliable than simple averages. 
                Improvement percentages show gains over the baseline prompt.
            </p>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="switchTab('scene')">
                🎬 Scene Description (${sortedSceneVersions.length} versions)
            </button>
            <button class="tab" onclick="switchTab('match')">
                ⭐ Video-Article Match (${sortedMatchVersions.length} versions)
            </button>
        </div>
        
        <div id="scene-tab" class="tab-content active">
            ${sortedSceneVersions.length === 0 ? `
                <div class="empty">
                    <h2>No Optimized Prompts Yet</h2>
                    <p>Process some articles to start FPO optimization.</p>
                </div>
            ` : sortedSceneVersions.map((version, index) => {
                const isBest = index === 0 && version.performance.samples > 0;
                const isCurrent = version.isActive;
                const score = version.performance.avgScore;
                const weight = version.performance.weight || 0;
                const samples = version.performance.samples || 0;
                const scoreClass = score === null ? 'poor' : (score >= 0.8 ? '' : score >= 0.6 ? 'low' : 'poor');
                const isTested = samples > 0;
                const generation = version.generation || 0;
                const createdDate = version.createdAt ? new Date(version.createdAt).toLocaleString() : 'N/A';
                
                // Calculate improvement from baseline (only for tested prompts)
                let improvement = 0;
                let improvementText = '';
                let improvementClass = '';
                if (isTested && testedVersions.length > 1) {
                  // Find actual baseline prompt (id: "baseline"), not just worst prompt
                  const baseline = testedVersions.find(v => v.id === 'baseline' || (v.name && v.name.toLowerCase().includes('baseline')));
                  if (baseline && baseline.performance.avgScore !== null && version.id !== baseline.id) {
                    const baselineScore = baseline.performance.avgScore;
                    const diff = score - baselineScore;
                    
                    // Handle negative or near-zero baseline scores
                    if (Math.abs(baselineScore) < 0.001) {
                      // Use absolute difference in percentage points when baseline is near zero
                      improvement = diff * 100;
                      improvementText = improvement > 0 ? `+${improvement.toFixed(1)}pp` : `${improvement.toFixed(1)}pp`;
                    } else {
                      // Normal percentage calculation with absolute baseline
                      improvement = (diff / Math.abs(baselineScore)) * 100;
                      // Keep sign based on actual difference, not baseline sign
                      improvementText = diff > 0 ? `+${Math.abs(improvement).toFixed(1)}%` : `-${Math.abs(improvement).toFixed(1)}%`;
                    }
                    improvementClass = diff > 0 ? 'positive' : (diff < 0 ? 'negative' : '');
                  }
                }
                
                return `
                <div class="prompt-card ${isBest ? 'best' : ''} ${isCurrent ? 'current' : ''} ${!isTested ? 'untested' : ''}">
                    ${isBest ? '<span class="badge best">🏆 BEST</span>' : ''}
                    ${!isTested ? '<span class="badge" style="background: #71767b;">NOT TESTED</span>' : ''}
                    ${isCurrent && !isBest && isTested ? '<span class="badge current">CURRENT</span>' : ''}
                    ${generation > 0 ? `<span class="badge" style="background: #7c3aed;">GEN ${generation}</span>` : ''}
                    
                    <div class="prompt-header">
                        <div>
                            <div class="prompt-version">${version.name || version.id}</div>
                            ${improvementText ? `<span class="improvement ${improvementClass}">${improvementText} from baseline</span>` : ''}
                        </div>
                        <div class="prompt-score ${scoreClass}">${isTested ? (score * 100).toFixed(1) : '—'}</div>
                    </div>
                    
                    <div class="prompt-stats">
                        <div class="stat">📊 ${samples} sample${samples !== 1 ? 's' : ''}</div>
                        <div class="stat">⚖️ Weight: ${weight.toFixed(4)}</div>
                        <div class="stat">📈 Avg: ${score !== null ? (score * 100).toFixed(2) : 'N/A'}</div>
                    </div>
                    
                    <div class="prompt-text">${version.template}</div>
                </div>
                `;
            }).join('')}
        </div>
        
        <div id="match-tab" class="tab-content">
            ${sortedMatchVersions.length === 0 ? `
                <div class="empty">
                    <h2>No Optimized Prompts Yet</h2>
                    <p>Process and rate some articles to start FPO optimization.</p>
                </div>
            ` : sortedMatchVersions.map((version, index) => {
                const isBest = index === 0 && version.performance.samples > 0;
                const isCurrent = version.isActive;
                const score = version.performance.avgScore || 0;
                const weight = version.performance.weight || 0;
                const samples = version.performance.samples || 0;
                const scoreClass = score >= 0.8 ? '' : score >= 0.6 ? 'low' : 'poor';
                const generation = version.generation || 0;
                const createdDate = version.createdAt ? new Date(version.createdAt).toLocaleString() : 'N/A';
                
                // Calculate improvement from baseline
                const baseline = sortedMatchVersions.find(v => v.id === 'baseline' || (v.name && v.name.toLowerCase().includes('baseline')));
                let improvement = 0;
                let improvementText = '';
                let improvementClass = '';
                if (baseline && baseline.performance.avgScore !== null && version.id !== baseline.id && samples > 0) {
                  const baselineScore = baseline.performance.avgScore;
                  const diff = score - baselineScore;
                  
                  // Handle negative or near-zero baseline scores
                  if (Math.abs(baselineScore) < 0.001) {
                    // Use absolute difference in percentage points when baseline is near zero
                    improvement = diff * 100;
                    improvementText = improvement > 0 ? `+${improvement.toFixed(1)}pp` : `${improvement.toFixed(1)}pp`;
                  } else {
                    // Normal percentage calculation with absolute baseline
                    improvement = (diff / Math.abs(baselineScore)) * 100;
                    // Keep sign based on actual difference, not baseline sign
                    improvementText = diff > 0 ? `+${Math.abs(improvement).toFixed(1)}%` : `-${Math.abs(improvement).toFixed(1)}%`;
                  }
                  improvementClass = diff > 0 ? 'positive' : (diff < 0 ? 'negative' : '');
                }
                
                return `
                <div class="prompt-card ${isBest ? 'best' : ''} ${isCurrent ? 'current' : ''}">
                    ${isBest ? '<span class="badge best">🏆 BEST</span>' : ''}
                    ${isCurrent && !isBest ? '<span class="badge current">CURRENT</span>' : ''}
                    ${generation > 0 ? `<span class="badge" style="background: #7c3aed;">GEN ${generation}</span>` : ''}
                    
                    <div class="prompt-header">
                        <div>
                            <div class="prompt-version">${version.name || version.id}</div>
                            ${improvementText ? `<span class="improvement ${improvementClass}">${improvementText} from baseline</span>` : ''}
                        </div>
                        <div class="prompt-score ${scoreClass}">${(score * 100).toFixed(1)}</div>
                    </div>
                    
                    <div class="prompt-stats">
                        <div class="stat">📊 ${samples} sample${samples !== 1 ? 's' : ''}</div>
                        <div class="stat">⚖️ Weight: ${weight.toFixed(4)}</div>
                        <div class="stat">📈 Avg: ${score !== null ? (score * 100).toFixed(2) : 'N/A'}</div>
                    </div>
                    
                    <div class="prompt-text">${version.template}</div>
                </div>
                `;
            }).join('')}
        </div>
    </div>
    
    <script>
        // Check FPO status on page load and periodically
        async function checkFPOStatus() {
            try {
                const res = await fetch('/api/flags/status');
                const data = await res.json();
                
                const btn = document.getElementById('runFpoBtn');
                const status = document.getElementById('fpoStatus');
                
                if (data.fpoRunning) {
                    // FPO is running (from script or button)
                    btn.style.display = 'none';
                    status.style.display = 'flex';
                } else {
                    // FPO is not running
                    btn.style.display = 'inline-block';
                    status.style.display = 'none';
                }
            } catch (err) {
                console.error('Error checking FPO status:', err);
            }
        }
        
        // Check status on page load
        checkFPOStatus();
        
        // Poll every 3 seconds
        setInterval(checkFPOStatus, 3000);
        
        function switchTab(tab) {
            // Update tab buttons
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tab + '-tab').classList.add('active');
        }
        
        async function runFPO() {
            if (!confirm('Run FPO iteration? This will evaluate all prompts on available test data.')) return;
            
            const btn = document.getElementById('runFpoBtn');
            const status = document.getElementById('fpoStatus');
            
            // Hide button immediately
            btn.style.display = 'none';
            status.style.display = 'flex';
            
            try {
                const res = await fetch('/api/fpo/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ iterations: 1 })
                });
                
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'FPO request failed');
                }
                
                const data = await res.json();
                
                if (data.success) {
                    const message = 'FPO Complete!\\n\\n' +
                        'Iterations: ' + data.iterations + '\\n' +
                        'Final Prompt: ' + data.finalPrompt + '\\n' +
                        'Evolved: ' + data.evolved + ' new prompts';
                    alert(message);
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                    btn.style.display = 'inline-block';
                    status.style.display = 'none';
                }
            } catch (err) {
                alert('Error: ' + err.message);
                btn.style.display = 'inline-block';
                status.style.display = 'none';
            }
        }
    </script>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Error loading prompts</h1><p>${error.message}</p>`);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  const { log } = require('./utils/logger');
  log.error(`${req.method} ${req.path} - ${err.message}`);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });
});

/**
 * Start background queue processing
 * Processes queued jobs every 5 seconds
 */
const startQueueProcessing = () => {
  const { processQueues } = require('./utils/queue');
  const { processFPOJob } = require('./workers/fpoWorker');
  
  const processors = {
    fpo: processFPOJob,
    // Add other processors here as needed
    // fetch: processFetchJob,
    // describe: processDescribeJob,
    // rate: processRateJob,
  };
  
  // Process queues every 5 seconds
  setInterval(async () => {
    try {
      await processQueues(processors);
    } catch (error) {
      console.error('Queue processing error:', error.message);
    }
  }, 5000); // Check every 5 seconds
  
  // Also process immediately on startup
  processQueues(processors).catch(err => {
    console.error('Initial queue processing error:', err.message);
  });
};

const startServer = async () => {
  const { log } = require('./utils/logger');
  
  try {
    // Initialize Weave logging
    await initWeave();
    log.info('Weave initialized');
    
    // Start background queue processing
    startQueueProcessing();
    log.info('Queue processing started');

    // Start server
    server = app.listen(config.port, () => {
      log.info(`Prompt Reels API running on port ${config.port}`);
      log.info(`Environment: ${config.nodeEnv}`);
      log.info(`Using Gemini model: ${config.geminiModel}`);
      log.info(`Weave project: ${config.wandbProject}`);
      log.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    const { log } = require('./utils/logger');
    log.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = () => {
  const { log } = require('./utils/logger');
  log.warn('Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      log.info('Server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      log.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGUSR2', shutdown); // nodemon restart signal

startServer();

module.exports = app;
