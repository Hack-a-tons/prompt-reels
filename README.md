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

## 🔬 Federated Prompt Optimization (FPO)
This project is inspired by [*FedPOB: Sample-Efficient Federated Prompt Optimization via Bandits*](https://arxiv.org/abs/2509.24701) and related works such as *FedPrompt* and *PromptFL*.  

The FPO principle allows multiple agents to improve a shared prompt collaboratively **without sharing raw data**. Each client locally evaluates prompts on its own data and reports only summarized performance (reward). The central aggregator merges results and redistributes improved prompts.

**In Prompt Reels:**
- Each domain (e.g., news, sports, short-form reels) acts as a federated client.
- Each client tests several prompt templates using Google Gemini to describe video scenes.
- Local performance metrics (semantic similarity to known descriptions) are sent to an aggregator.
- Aggregator updates prompt priorities and distributes a new global prompt.
- Weave visualizes the improvement curve over time.

This approach enables *self-improving behavior* without retraining the model itself.

**References:**
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
**Removes:**
- `output/*` - All analysis results, scene data, logs
- `uploads/*` - All uploaded videos
- `data/prompts.json` - Reset to original (unless `-k`)

### Upload & List Videos
```bash
# Upload a video
./scripts/upload.sh video.mp4          # Upload to prod
./scripts/upload.sh video.mp4 dev      # Upload to dev

# List uploaded videos (with VIDEO_IDs)
./scripts/list.sh                      # List prod videos
./scripts/list.sh dev                  # List dev videos
./scripts/list.sh -f                   # Show full filenames
```

**Upload returns:**
- `VIDEO_ID` - Use this with detect-scenes.sh, analyze, etc.
- Latest VIDEO_ID saved to `/tmp/prompt-reels-latest-video-id`
- Shows example commands with the VIDEO_ID

**List shows:**
- All uploaded videos with their VIDEO_IDs
- File sizes and upload dates
- Example usage commands

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

# Use the script (VIDEO_ID from upload.sh or list.sh)
./scripts/detect-scenes.sh video-1234567890           # Basic
./scripts/detect-scenes.sh -f video-1234567890        # With frames
./scripts/detect-scenes.sh -t 0.3 video-1234567890    # Custom threshold

# Complete workflow
./scripts/upload.sh video.mp4                         # Returns VIDEO_ID
./scripts/detect-scenes.sh -f <VIDEO_ID>              # Detect & extract frames
```

**How it works:**
- Uses ffmpeg's scene detection filter (no file splitting needed!)
- Analyzes frame differences to detect cuts and transitions
- Lower threshold (0.2-0.3): More sensitive, detects subtle changes
- Higher threshold (0.5-0.6): Less sensitive, only major scene changes
- Default (0.4): Good balance for most videos
- Optionally extracts 3 frames per scene (beginning/middle/end)

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
