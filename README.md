# Prompt Reels 🎥
### A Self-Improving Video Description Agent

**Prompt Reels** automatically splits videos into scenes, describes each scene with **Google Gemini**, and improves its own prompt instructions over time through a federated-style optimization loop inspired by recent *Federated Prompt Optimization (FPO)* research.  
Built for **WeaveHacks 2 — Self-Improving Agents**.

---

## 🧠 Overview
### Core idea
1. Split a video into scenes (via `ffmpeg`).
2. Extract representative frames.
3. Use **Google Gemini (Vision + Text)** to generate detailed scene descriptions.
4. Compare AI output with public captions or reference text (e.g., news articles via Tavily or scraped pages via BrowserBase).
5. Optimize prompt wording across domains using a simplified *Federated Prompt Optimization (FPO)* loop.
6. Log and visualize everything with **Weights & Biases Weave**.

---

## 🏗️ Architecture

### High-Level Components
| Component | Description |
|------------|-------------|
| **Client App** | Simple web UI (React/Svelte) or command-line interface to upload video, view scenes, and inspect results. |
| **API Server** | Node.js + Express backend that handles uploads, runs `ffmpeg` scene splitting, and calls Gemini API. Exposes endpoints for analysis and results retrieval. |
| **AI Engine** | Google Gemini multimodal model that processes frames and returns descriptions. Uses Gemini embeddings for scoring semantic similarity to reference captions. |
| **Prompt Optimizer (FPO)** | Implements simplified Federated Prompt Optimization logic — simulating multiple clients (domains) that evaluate prompts locally and share only scores with the aggregator. |
| **Aggregator / Global Model** | Merges prompt feedback, averages performance metrics, and redistributes an improved global prompt template. |
| **Weave Tracking** | Logs all runs, prompt versions, and performance data to W&B Weave for observability and visualization. |

---

## 🧩 How Each Tool Is Used

| Tool | Purpose | Integration in Prompt Reels |
|------|----------|------------------------------|
| **Google Gemini** | Core AI engine (Vision + Text) for describing video scenes and generating embeddings for similarity scoring. | Used for both multimodal captioning and prompt evaluation; accessed via `@google/generative-ai` Node.js SDK. |
| **Weights & Biases Weave** | Experiment tracking, data lineage, and visualization. | Logs every experiment run — including prompts, scores, and improvement trends — to demonstrate self-improvement. Required for WeaveHacks eligibility. |
| **ffmpeg** | Scene segmentation and frame extraction from videos. | Used server-side to break input videos into smaller sequences (e.g., 3 seconds per scene) and capture representative frames. |
| **Node.js + Express** | Backend server environment and REST API layer. | Provides endpoints for uploading videos, running Gemini analysis, and returning results to the UI or CLI. |
| **Tavily API (optional)** | Retrieval of external news or web content for ground-truth caption comparison. | Used to fetch text or metadata about the video’s topic for FPO evaluation or scoring. |
| **BrowserBase (optional)** | Headless browser / web automation environment. | Used to scrape public video descriptions or captions directly from YouTube or news portals for evaluation. |
| **Docker** | Containerization for portable deployment. | Wraps Node.js server, Gemini integration, and ffmpeg environment into a reproducible runtime. |
| **React / Svelte (optional)** | Frontend client for demo and visualization. | Displays video upload, scene descriptions, and Weave-generated improvement metrics interactively. |

---

## 🔬 Federated Prompt Optimization (FPO) - How It Works

This project implements **Federated Prompt Optimization (FPO)**, inspired by [*FedPOB: Sample-Efficient Federated Prompt Optimization via Bandits*](https://arxiv.org/abs/2509.24701) and related works (*FedPrompt*, *PromptFL*).

### 🎯 The Problem
AI models are only as good as their prompts. But prompt engineering is:
- Manual and time-consuming
- Requires expertise
- Doesn't improve automatically
- Hard to maintain across deployments

### 💡 The Solution: FPO
**Prompts that optimize themselves** across multiple deployments without centralized training or sharing raw data.

---

### 🔄 How FPO Works in Prompt Reels

#### **Two Optimization Loops**

We optimize **2 separate prompts** that run continuously:

1. **Scene Description Prompt** (`video-scene-description`)
   - Task: Describe what's happening in video scenes
   - Input: Video frames (3 per scene)
   - Output: Text description
   - Evaluation: Semantic similarity to ground truth

2. **Video-Article Match Prompt** (`video-article-match`)
   - Task: Rate how well video matches article (0-100)
   - Input: Article text + scene descriptions + transcripts
   - Output: Match score + explanation
   - Evaluation: Human feedback or heuristic scoring

#### **Automatic, No Human Involvement**

FPO runs **automatically** during normal operations:

```
Article Fetch → Describe Scenes → Rate Match → FPO Updates
     ↓              ↓                  ↓             ↓
   Fetch API    Describe API       Rate API    Background
   (manual)     (uses FPO v1)    (uses FPO v2)  (auto-update)
```

**No separate FPO command needed!** It runs in the background as you process videos.

#### **Iteration Process**

Each prompt goes through **multiple iterations**:

```javascript
// Default configuration
const FPO_CONFIG = {
  maxIterations: 10,        // Try 10 prompt variations
  samplesPerIteration: 3,   // Test each on 3 videos
  convergenceThreshold: 0.05 // Stop if < 5% improvement
}
```

**When does it stop?**
- After 10 iterations (max)
- When improvement < 5% (converged)
- When no better prompts found (local optimum)

#### **How Prompts Improve**

1. **Start with baseline prompt** (v1.0)
   ```
   "Describe this video scene in detail"
   ```

2. **AI generates variations** (v1.1, v1.2, v1.3)
   ```
   "Analyze these frames and describe: 1) Main subjects..."
   "Examine the video frames. Identify key visual elements..."
   "Describe what's happening in this scene, focusing on..."
   ```

3. **Test each variant** on real data (3 videos each)
   - Run scene description with variant
   - Compare to ground truth (article text)
   - Calculate similarity score

4. **Select best performing** variant
   ```
   v1.0: score 0.72
   v1.1: score 0.78  ← WINNER
   v1.2: score 0.75
   ```

5. **Promote winner to v2.0**, repeat until converged

---

### 📊 Where to See Prompt History

**1. Local File System**
```bash
# All prompts stored in JSON
cat data/prompts.json | jq
```

**Structure:**
```json
{
  "video-scene-description": {
    "id": "video-scene-description",
    "name": "Video Scene Description",
    "currentVersion": "1.3",
    "versions": [
      {
        "version": "1.0",
        "template": "Original prompt...",
        "performance": { "avgScore": 0.72, "samples": 10 },
        "createdAt": "2025-01-12T10:00:00Z"
      },
      {
        "version": "1.1",
        "template": "Improved prompt...",
        "performance": { "avgScore": 0.78, "samples": 10 },
        "createdAt": "2025-01-12T10:15:00Z"
      },
      {
        "version": "1.2",
        "template": "Even better prompt...",
        "performance": { "avgScore": 0.81, "samples": 10 },
        "createdAt": "2025-01-12T10:30:00Z",
        "isActive": true
      }
    ],
    "history": [...]
  }
}
```

**2. Weights & Biases (W&B) Weave**

View online at: https://wandb.ai/prompt-reels

- **Runs Tab**: See each FPO iteration
- **Metrics**: Track avg_score over time
- **Artifacts**: View prompt versions
- **Charts**: Visualize improvement curve

**3. API Endpoints**
```bash
# Get all prompts
curl https://reels.hurated.com/api/prompts | jq

# Get specific prompt history
curl https://reels.hurated.com/api/prompts/video-scene-description | jq

# See current version
curl https://reels.hurated.com/api/prompts/video-scene-description/current | jq
```

---

### 🚀 Running FPO

#### **Automatic (Recommended)**
FPO runs automatically when you:
```bash
# Process articles (FPO runs in background)
./scripts/process-article.sh
./scripts/process-articles.sh 10

# Use dashboard button
# Click "Add 10 Articles" → FPO runs automatically
```

#### **Manual (For Testing)**
```bash
# Run FPO optimization explicitly
node src/core/promptOptimizer.js --domain video-scene-description --iterations 10

# Or via API
curl -X POST https://reels.hurated.com/api/fpo/optimize \
  -H "Content-Type: application/json" \
  -d '{"domain":"video-scene-description","iterations":10}'
```

---

### 📈 Monitoring Progress

**Watch prompts improve in real-time:**

```bash
# Terminal 1: Process articles
./scripts/process-articles.sh 20

# Terminal 2: Watch prompt evolution
watch -n 5 'cat data/prompts.json | jq ".\"video-scene-description\".currentVersion, .\"video-scene-description\".versions[-1].performance"'
```

**Expected output:**
```
Iteration 1: avgScore: 0.72
Iteration 2: avgScore: 0.75 (+4.2% improvement)
Iteration 3: avgScore: 0.78 (+4.0% improvement)
Iteration 4: avgScore: 0.79 (+1.3% improvement)
Iteration 5: avgScore: 0.79 (+0.0% improvement)
→ CONVERGED (< 5% improvement)
```

---

### 🎓 Key Concepts

**1. No Model Retraining**
- We don't fine-tune Gemini or GPT-4
- We only optimize the prompt text
- Much faster and cheaper

**2. Federated = No Data Sharing**
- Each deployment can run FPO independently
- Only prompt text and scores are shared (optional)
- Raw video data stays local

**3. Multi-Arm Bandit**
- Tests multiple prompt variants in parallel
- Allocates more resources to promising variants
- Quickly eliminates poor performers

**4. Continuous Learning**
- System gets better with every video processed
- No manual intervention needed
- Improvements compound over time

---

### 🔍 Example: Scene Description Evolution

**Version 1.0 (Baseline)**
```
Prompt: "Describe this video scene"
Output: "A person is standing outside."
Score: 0.65
```

**Version 1.5 (After 5 iterations)**
```
Prompt: "Analyze these frames from a video scene. Describe: 
1) Main subjects and their actions
2) Setting and environment
3) Key visual elements
4) Temporal progression across frames"

Output: "A news reporter in professional attire stands in front of 
a crashed helicopter on a Sacramento highway at night. Bystanders 
gather around the damaged aircraft. Emergency vehicles arrive with 
flashing lights as the crowd grows larger."

Score: 0.82 (+26% improvement!)
```

**Version 2.0 (After 10 iterations)**
```
Score: 0.87 (+34% improvement from baseline)
```

---

### 📚 References
- [FedPOB: Sample-Efficient Federated Prompt Optimization via Bandits](https://arxiv.org/abs/2509.24701). arXiv:2509.24701 (2025)
- [FedPrompt: Communication-Efficient and Privacy Preserving Prompt Tuning in Federated Learning](https://arxiv.org/abs/2208.12268). arXiv:2208.12268 (2022)
- [Federated Prompting and Chain-of-Thought Reasoning for Improving LLMs Answering](https://arxiv.org/abs/2310.15080). arXiv:2310.15080 (2023)

---

## 🧰 Tech Stack
| Layer | Tools |
|-------|-------|
| Backend | Node.js / Express |
| AI Models | **Google Gemini (Multimodal)** |
| Experiment Tracking | **W&B Weave** ✅ (required) |
| Video Processing | ffmpeg |
| Optional Integrations | Tavily (API for news data), BrowserBase (web automation) |
| Frontend (optional) | React + Tailwind / Svelte mini UI |
| Deployment | Docker |

---

## ⚙️ Quick Start

### Prerequisites
- Node.js 20+
- npm
- Docker (for production deployment)

### Development Setup
```bash
# Clone and install
git clone git@github.com:Hack-a-tons/prompt-reels.git
cd prompt-reels
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys:
# - GOOGLE_API_KEY (Google Gemini)
# - WANDB_API_KEY (Weights & Biases)
# - AZURE_OPENAI_API_KEY (optional fallback)
```

### Run Development Server
```bash
./scripts/run-dev.sh     # Quick start (frees port + starts server)
npm run dev              # Start with nodemon (auto-reload)
npm start                # Start without auto-reload
```

**Note:** 
- `scripts/run-dev.sh` can be run from anywhere and automatically handles port conflicts
- nodemon ignores `data/`, `uploads/`, and `output/` directories to prevent restarts during FPO runs and video processing

### Test the API
```bash
./test.sh health          # Test production server (default)
./test.sh health dev      # Test dev server (localhost)
./test.sh -v health       # Verbose mode (shows curl & JSON)
./test.sh -p5 health      # Pause 5s after test
./test.sh all -pv         # Run all tests on prod with pause & verbose
```

### Free Port (if needed)
```bash
npm run free-port         # Kill processes using PORT from .env
# Or directly:
./scripts/free-port.sh
```

### Reset Prompts (if needed)
```bash
npm run reset-prompts     # Reset prompts.json to clean template
# Or directly:
./scripts/reset-prompts.sh
```
**Note:** `data/prompts.json` accumulates performance history during FPO runs. Reset it before committing if you want a clean state.

### Cleanup (clear outputs and uploads)
```bash
# Interactive (with confirmation)
./scripts/cleanup.sh

# Auto-confirm
./scripts/cleanup.sh -y

# Keep prompts data (don't reset)
./scripts/cleanup.sh -y -k
```
- Shows example commands with the VIDEO_ID

**List shows:**
- All uploaded videos with their VIDEO_IDs
- File sizes and upload dates
- Scene detection status
- Example usage commands

### Fetch News Articles with Videos 📰

**Automatically fetch news articles with embedded videos** using Tavily (search) and BrowserBase (extraction):

```bash
# Fetch latest news articles with videos
./scripts/fetch-news.sh

# Custom search query
./scripts/fetch-news.sh -q "technology news video"

# Try more articles (default: 5)
./scripts/fetch-news.sh -n 10

# On dev server
./scripts/fetch-news.sh dev
```

**What it does:**
1. **Searches Tavily** for news articles matching query
2. **Extracts video URL** from article page using BrowserBase
3. **Downloads video** to `uploads/articles/`
4. **Saves metadata** to `output/articles/`

**Metadata saved:**
```json
{
  "articleId": "article-1234567890-123456",
  "source": {
    "url": "https://example.com/article",
    "domain": "example.com"
  },
  "video": {
    "url": "https://example.com/video.mp4",
    "type": "video" | "embed",
    "platform": "direct" | "youtube" | "vimeo",
    "localPath": "uploads/articles/article-123.mp4"
  },
  "title": "Article Title",
  "description": "Article description",
  "text": "Full article text",
  "fetchedAt": "2025-01-12T10:30:00.000Z",
  "images": []
}
```

**List fetched articles:**
```bash
./scripts/list.sh articles        # List all articles
./scripts/list.sh articles dev    # List on dev server
```

**Requirements:**
- `TAVILY_API_KEY` in `.env`
- `BROWSERBASE_API_KEY` in `.env`
- `BROWSERBASE_PROJECT_ID` in `.env`

**After fetching, analyze the video:**
```bash
# Get article ID from list.sh articles
./scripts/detect-scenes.sh article-1234567890-123456
./scripts/describe-scenes.sh article-1234567890-123456
```

### Cleanup 🧹

```bash
# Clean everything (with confirmation)
./scripts/cleanup.sh all

# Clean specific targets
./scripts/cleanup.sh articles     # Clean fetched articles only
./scripts/cleanup.sh output       # Clean output (keep articles)
./scripts/cleanup.sh uploads      # Clean uploads (keep articles)
./scripts/cleanup.sh prompts      # Reset prompts to defaults

# Skip confirmation
./scripts/cleanup.sh all -y
```

**Targets:**
- `all` - Everything (output + uploads + articles + prompts)
- `articles` - Fetched news articles and videos
- `output` - Analysis results, logs (except articles)
- `uploads` - Uploaded videos (except articles)
- `prompts` - Reset `data/prompts.json` to defaults

### Production Deployment
```bash
# Quick deploy with commit
./scripts/deploy.sh -m "Your commit message"

# Deploy without committing (push existing commits)
./scripts/deploy.sh -s

# Deploy without rebuilding (faster)
./scripts/deploy.sh -b

# Manual Docker Compose
docker compose up -d      # Start in detached mode
docker compose logs -f    # View logs
docker compose down       # Stop
```

**Deploy script does:**
1. Check git status
2. Commit changes (if `-m` provided)
3. Push to GitHub
4. SSH to reels.hurated.com
5. Pull latest changes
6. Rebuild & restart container
7. Show logs & health check

**Nginx Configuration:**  
See `nginx.conf.example` for full configuration. The main domain `reels.hurated.com` proxies to `localhost:15000`.

**No subdomains needed** - All API endpoints are served from the main domain (e.g., `https://reels.hurated.com/api/upload`). If you add a frontend later, you can either:
- Serve it from the same domain with different paths, or
- Use `api.reels.hurated.com` for the API if you prefer separation

---

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

### Upload Video
```bash
POST /api/upload
Content-Type: multipart/form-data
Body: video file
Response: { videoId, filename, size, path }
```

### Analyze Video
```bash
POST /api/analyze
Content-Type: application/json
Body: { videoId, promptId? }
Response: { success, result, outputPath }
```

### Get Prompts
```bash
GET /api/prompts
Response: { version, templates, domains, global_prompt }
```

### Get Results
```bash
GET /api/results/:videoId
Response: Analysis results JSON
```

### Detect Scenes
```bash
POST /api/detect-scenes
Content-Type: application/json
Body: { 
  videoId,              // Required: Video ID from upload
  threshold: 0.4,       // Optional: Scene change sensitivity (0.0-1.0)
  extractFrames: false  // Optional: Extract 3 frames per scene
}
Response: { 
  success, 
  videoId, 
  sceneCount, 
  scenes: [
    {
      sceneId, 
      start,      // Start time in seconds
      end,        // End time in seconds
      duration,   // Scene duration
      frames: []  // If extractFrames=true
    }
  ],
  outputPath 
}

# Two-step workflow

# Step 1: Detect scene timestamps (fast)
./scripts/detect-scenes.sh video-1234567890           # Timestamps only
./scripts/detect-scenes.sh -t 0.3 video-1234567890    # Custom threshold

# Step 2: Extract frames + generate AI descriptions (slower)
./scripts/describe-scenes.sh video-1234567890         # Frames + descriptions

# Complete workflow
./scripts/upload.sh video.mp4                         # 1. Upload → get VIDEO_ID
./scripts/detect-scenes.sh <VIDEO_ID>                 # 2. Detect scenes (fast)
./scripts/describe-scenes.sh <VIDEO_ID>               # 3. Extract + describe (AI)
```

**How it works:**

**detect-scenes.sh** (Fast - timestamps only):
- Uses ffmpeg's scene detection filter (no file splitting!)
- Analyzes frame differences to detect cuts/transitions
- Lower threshold (0.2-0.3): More sensitive, detects subtle changes
- Higher threshold (0.5-0.6): Less sensitive, only major scene changes
- Default (0.4): Good balance for most videos
- **Output:** JSON with scene timestamps (start, end, duration)

**describe-scenes.sh** (Slower - frames + AI):
- Extracts 3 frames per scene (beginning/middle/end)
- **Generates AI descriptions** based on the 3 frames
- Uses Azure OpenAI or Gemini to analyze scene content
- Descriptions saved in JSON and displayed in viewer
- Can specify threshold (re-detects scenes if needed)

### Fetch News Article
```bash
POST /api/fetch-news
Content-Type: application/json
Body: {
  query: "latest news video",  // Search query
  maxResults: 5                // Max articles to try
}
Response: {
  success: true,
  article: {
    articleId,
    source: { url, domain },
    video: { url, type, platform, localPath },
    title,
    description,
    text,
    fetchedAt
  }
}
```

### List Articles
```bash
GET /api/articles
Response: {
  articles: [
    {
      articleId,
      title,
      source,
      url,
      videoType,
      hasLocalVideo,
      fetchedAt
    }
  ],
  count
}
```

### Get Article
```bash
GET /api/articles/:articleId
Response: Full article data with metadata
```

### View Detected Scenes 🎥

**Visual Scene Viewer** - Beautiful web interface to view scenes with video player and frames:

```bash
# In browser (after scene detection)
https://api.reels.hurated.com/api/scenes/<VIDEO_ID>

# Or get scenes as JSON
https://api.reels.hurated.com/api/scenes/<VIDEO_ID>/json
```

**Features:**
- 🎬 Video player with auto-play
- 📊 Stats (scene count, threshold, date)
- 🖼️ 3 frames per scene (if extracted)
- ⏱️ Click scene time to seek video
- 🔍 Auto-highlight current scene during playback
- 📱 Responsive design (mobile-friendly)
- 📝 Scene descriptions (when added)

**Check which videos have scenes detected:**

```bash
# List all videos with scene detection
./scripts/detected.sh

# Show scenes for specific video
./scripts/detected.sh video-1234567890

# Show full JSON
./scripts/detected.sh -j video-1234567890

# On dev server
./scripts/detected.sh dev
```

**Updated list.sh** now shows scene detection status:

```bash
./scripts/list.sh

# Output:
# 1. video-1760239791824-656504757
#    Size: 61M
#    Date: Oct 12 02:30
#    ✓ Scenes: 12
#    https://api.reels.hurated.com/api/scenes/video-1760239791824-656504757
```

### FPO (Federated Prompt Optimization) with Evolution 🧬

Complete guide to the self-improving prompt system.

#### Quick Start
```bash
# Start evolution (5 iterations on prod)
./evolve.sh start

# Check evolution status
./evolve.sh status

# View all prompts
./scripts/show-prompts.sh
```

#### 📍 Where Evolved Prompts Are Stored

**Location:** `data/prompts.json`

**Key Fields:**
- **`generation`**: 0 = original, 1+ = evolved
- **`parents`**: IDs of parent prompts used in crossover
- **`weight`**: Current performance score (higher = better)
- **`performance`**: History of scores from all iterations
- **`created`**: When the evolved prompt was created

#### 🔧 API Endpoints

**Start Evolution:**
```bash
POST /api/fpo/run
{
  "iterations": 5,           // Number of optimization rounds
  "enableEvolution": true,   // Enable genetic crossover (default: true)
  "evolutionInterval": 2     // Evolve every N iterations (default: 2)
}

# Example
curl -X POST https://api.reels.hurated.com/api/fpo/run \
  -H "Content-Type: application/json" \
  -d '{"iterations": 7, "enableEvolution": true}'
```

**Get Status:**
```bash
GET /api/fpo/status
# Returns: globalPrompt, populationSize, maxGeneration, templates with weights

curl https://api.reels.hurated.com/api/fpo/status | jq .
```

#### 🧬 Genetic Crossover

**How it works:**
- Every 2 iterations (configurable), the top 2 prompts "breed"
- Azure GPT intelligently combines their best features
- Creates a new "child" prompt that inherits strengths from both parents
- Population evolves: Gen 0 (original) → Gen 1 → Gen 2 → ...
- Worst performers removed (max 10 prompts)

**Evolution Timeline Example:**
```
Iteration 1: Test 5 original prompts
Iteration 2: Test + 🧬 Create Gen 1 (breed top 2)
Iteration 3: Test 6 prompts (5 original + 1 evolved)
Iteration 4: Test + 🧬 Create Gen 2
Iteration 5: Test 7 prompts
...
```

#### 🎯 Using evolve.sh

**Commands:**
```bash
# Start evolution (basic)
./evolve.sh start

# Custom iterations (7 rounds, evolve every 2)
./evolve.sh start -n 7 -i 2

# Upload video first, then evolve
./evolve.sh start -v sample.mp4

# Run on dev server
./evolve.sh start dev

# Check evolution status (shows top 5 with prompts)
./evolve.sh status

# View help
./evolve.sh --help
```

**Example Output:**
```
=== Prompt Evolution Status (prod) ===

Current Best: structured
Population Size: 6 prompts
Max Generation: 1

Composition:
  Original prompts: 5
  Evolved prompts: 1

Top 5 Prompts:

1. Structured Analysis (structured)
   Weight: 0.0230
   Prompt: "Analyze this video frame and provide: 
           1) Main subjects, 2) Actions occurring..."

2. Evolved Gen 1 (evolved_gen1_xyz)
   Weight: 0.0215
   Generation: 1
   Parents: baseline, technical
   Prompt: "Describe in detail what you see..."
```

#### 🧪 Testing Scenarios

**Quick Test (3 iterations):**
```bash
./evolve.sh start -n 3
# Fast (~6 min), creates 1 evolved prompt
```

**Standard Evolution (5 iterations):**
```bash
./evolve.sh start -n 5
# Balanced (~10 min), creates 2 generations
```

**Deep Evolution (10 iterations):**
```bash
./evolve.sh start -n 10 -i 2
# Thorough (~20 min), creates 5 generations
```

#### 📈 Success Metrics

**What to look for:**
1. **Evolved prompts outperforming originals** - Gen 1+ with higher weights
2. **Population growth** - More prompts over time (up to 10 max)
3. **Increasing weights** - Later generations perform better

**Example success:**
```
Gen 0 best: 0.033 (baseline)
Gen 1 best: 0.041 (evolved from baseline × technical)
Gen 2 best: 0.045 (evolved from Gen 1 × structured) ← Improving!
```

#### 🔍 Debugging

**Check if evolution is running:**
```bash
ssh reels.hurated.com "docker compose -f prompt-reels/compose.yml logs -f"
```

Look for: `🧬 EVOLUTION PHASE`, `✓ Created: Evolved Gen N`

**View evolved prompts:**
```bash
cat data/prompts.json | jq '.templates[] | select(.generation > 0)'
```

**Common issues:**
- No evolved prompts: Check `enableEvolution: true` in request
- All negative weights: Normal! Keep running more iterations
- Timeout errors: Reduce iterations or increase timeout

#### 🎓 Pro Tips

1. Run 7-10 iterations to see real evolution
2. Check W&B dashboard for visualizations
3. Use multiple test videos for better evaluation
4. Evolution interval of 2-3 works best
5. Monitor population diversity - keep original prompts
6. Patience! Evolution takes time to show results

#### 📊 View Best Prompts

```bash
# Show top 10 prompts (prod)
./scripts/show-prompts.sh

# Show top 5 on dev
./scripts/show-prompts.sh -n 5 dev

# Show all prompts
./scripts/show-prompts.sh -n 100
```

---

## 🔧 AI Provider Configuration

### Simple Provider Switch

Set your preferred AI provider in `.env`:

```bash
AI_PROVIDER=azure    # Use Azure OpenAI (default)
# or
AI_PROVIDER=gemini   # Use Google Gemini
```

**How it works:**
- Uses selected provider for image descriptions
- Auto-switches to fallback provider on failure
- Embeddings use hash-based similarity (no external API needed)

**Current configuration:**
- **Azure OpenAI**: GPT-4.1 deployment (recommended)
- **Google Gemini**: gemini-2.5-pro
- **Embeddings**: Hash-based (no quota limits)

---

## 🪄 Self-Improving Loop
- Each node (News / Sports / Reels) evaluates prompts on its local dataset.
- Scores are computed via cosine similarity of embeddings vs ground truth.
- Aggregator merges top prompts → new global prompt distributed to nodes.
- **Weave** logs every prompt version and score.

## 📊 Weights & Biases Integration

The system uses **Weave** (W&B's LLM experiment tracker) to log all experiments:

**Setup:**
```bash
# Set your W&B API key in .env
WANDB_API_KEY=your_wandb_api_key_here
WANDB_PROJECT=prompt-reels
```

**What gets logged:**
- Prompt evaluations (score, latency, domain, description)
- FPO iterations (global prompt, weights, performance)
- Video analyses (duration, frames, metadata)

**View your experiments:**
- **Cloud dashboard**: https://wandb.ai/your-username/prompt-reels
- **Local logs**: `output/weave-logs/weave-*.jsonl` (fallback if W&B unavailable)

**How it works:**
- System tries to connect to W&B cloud first
- Falls back to file-based logging if W&B unavailable
- All logging is non-blocking (won't break if W&B fails)

---

## 🎨 Recent UI/UX Improvements (January 2025)

### Dashboard Enhancements
- **Auto-playing Video Thumbnails**: Dashboard shows small video previews (160x90px) that autoplay
- **Score Coloring**: Match scores are color-coded (🟢 green: 70-100, 🟡 yellow: 40-69, 🔴 red: 0-39)
- **Multiline Titles**: Article titles can display up to 3 lines for better readability
- **Fast Video Loading**: Range request support with `preload="metadata"` for instant playback
- **Local Video Streaming**: All pages use `/api/articles/:articleId.mp4` endpoint with range support

### Dark Mode Everywhere
- **Consistent Theme**: Dashboard, article pages, scene viewer, and prompts page all use dark mode
- **Modern Colors**: `#0f1419` background, `#1d9bf0` accents, `#e7e9ea` text
- **Better Readability**: Reduced eye strain for long viewing sessions

### Markdown Rendering
- **Proper Formatting**: Article pages now render markdown correctly (bold, italic, links)
- **Fixed Multiline Links**: Links split across multiple lines are properly normalized
- **Uses marked.js**: Client-side rendering for fast, clean display

### Interactive Features
- **Buttons Hide Immediately**: Action buttons disappear on click, show spinners
- **Real-time Status**: Polling shows operation status every 3 seconds
- **No Duplicate Actions**: Flag system prevents double-clicking

---

## 🔄 Queue System & Background Processing

### Persistent Queues
Location: `data/queues/` (survives Docker restarts)

**Four Queue Types:**
- 📥 **Fetch Queue**: Article fetching operations
- 🎬 **Describe Queue**: Scene description tasks
- ⭐ **Rate Queue**: Article rating operations  
- 🧠 **FPO Queue**: Prompt optimization runs

**Features:**
- Persists across Docker restarts (stored in `data/queues/*.json`)
- Only 1 action of each type runs at once, others wait in queue
- Up to 4 actions run simultaneously (1 of each type)
- Auto-retry failed items (max 3 attempts)
- Status: `queued` → `processing` → `complete`

**View Queue Status:**
```bash
# Show all queues and flags
./scripts/status.sh

# Watch mode (refresh every 3s)
./scripts/status.sh --watch

# Check via API
curl https://api.reels.hurated.com/api/queue/status | jq .
```

### Flag System
Location: `/tmp/prompt-reels-flags/` (cleared on Docker restart)

**Features:**
- Prevents duplicate operations
- Shows UI feedback (spinners)
- Cleared automatically on completion or restart

---

## 🚀 Automatic FPO Optimization

### Runs Automatically
FPO now runs **automatically** when you rate articles. No manual intervention needed!

**What Happens:**
1. Article is rated (match score calculated)
2. FPO automatically triggered
3. All 5 prompts evaluated on article frames vs article text
4. Scores saved to `performance[]` arrays
5. Prompts ranked by semantic similarity

### Manual FPO Button
Prompts page has a manual trigger at https://reels.hurated.com/prompts

Click **"🚀 Run FPO Iteration"** button to:
- Use described articles (13+ available)
- Evaluate all prompts on actual frames
- Compare to article text (first 500 chars)
- Calculate semantic similarity scores
- Update `data/prompts.json`

**No more "No test data available"!** ✅

---

## 📊 Video Optimization & Performance

### Range Request Support
All video endpoints support HTTP range requests for instant playback:

```bash
GET /api/articles/:articleId.mp4
# Supports: Range: bytes=0-1048575
# Returns: 206 Partial Content
```

**Benefits:**
- ✅ Instant video preview (loads metadata only ~100KB)
- ✅ Fast seeking without full download
- ✅ Reduced bandwidth usage
- ✅ Dashboard videos load in <1 second

### Whisper Rate Limiting
Audio transcription respects API limits:
- Proactive: 3 requests/minute (20s between calls)
- Prevents 429 errors before they happen
- Clear logging of wait times

---

## 🏆 Prize Targets
- ✅ **Best Use of Weave**  
- 🧠 **Best Self-Improving Agent**  
- ⚙️ **Best Use of Tavily** (optional: fetch reference text)  
- 🔗 **Best Use of BrowserBase** (optional: scrape video descriptions)  
- 👨‍💻 **Best Use of Google** (core AI model + cloud services)

---

## 👥 Team
| Name | Role | Focus |
|------|------|--------|
| **Denis Bystruev** | Developer / Architect | Backend, Gemini integration, Weave logging |
| **Valerii Egorov** | AI Ops / Data / Presentation | Video sourcing, prompt testing, docs & demo |

---

## 📅 Timeline (Condensed)
| Time | Task |
|------|------|
| Sat 12–6 pm | Build core pipeline (video → captions → Weave) |
| Sat 7–9 pm | Add prompt variation + scoring |
| Sun 9–12 pm | UI + integration polish |
| Sun 12–1 pm | Submission & demo |

---

## 📝 License
[MIT](https://opensource.org/license/mit)
