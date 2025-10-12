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
./run.sh                 # Quick start (frees port + starts server)
npm run dev              # Start with nodemon (auto-reload)
npm start                # Start without auto-reload
```

**Note:** 
- `run.sh` can be run from anywhere and automatically handles port conflicts
- nodemon ignores `data/`, `uploads/`, and `output/` directories to prevent restarts during FPO runs and video processing

### Test the API
```bash
./test.sh health          # Test health endpoint
./test.sh -v health       # Verbose mode (shows curl & JSON)
./test.sh -p5 health      # Pause 5s after test
./test.sh all -pv         # Run all tests with pause & verbose
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

### Production Deployment
```bash
# Using Docker Compose
docker compose up -d      # Start in detached mode
docker compose logs -f    # View logs
docker compose down       # Stop

# Domain: reels.hurated.com
# Port: 15000 (mapped internally)
```

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

### FPO (Federated Prompt Optimization)
```bash
POST /api/fpo/run
{
  "iterations": 3  // Number of optimization rounds
}
# Note: Uses extracted frames from previous video analysis for testing
# If no frames available, runs without image evaluation

GET /api/fpo/status
# Returns current prompt weights and performance
```

---

## ⚠️ API Quota Limits

### Gemini Free Tier
- **Per-minute**: 2 requests/minute (handled automatically with 30s delays)
- **Per-day**: 50 requests/day total
- **FPO impact**: 3 iterations × 5 prompts × 3 domains = 45 requests
- **Quota tracking**: Shows `[X/50] requests today` in logs

**If you hit daily quota:**
1. Wait for reset (midnight Pacific Time)
2. Use Azure OpenAI fallback (configure in `.env`)
3. Reduce iterations: `{"iterations": 1}`

---

## 🪄 Self-Improving Loop
- Each node (News / Sports / Reels) evaluates prompts on its local dataset.
- Scores are computed via cosine similarity of embeddings vs ground truth.
- Aggregator merges top prompts → new global prompt distributed to nodes.
- **Weave** logs every prompt version and score.

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
