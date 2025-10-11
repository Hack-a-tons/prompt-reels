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
This project is inspired by *FedPOB: Sample-Efficient Federated Prompt Optimization via Bandits* (arXiv:2509.24701) and related works such as *FedPrompt* and *PromptFL*.  

The FPO principle allows multiple agents to improve a shared prompt collaboratively **without sharing raw data**. Each client locally evaluates prompts on its own data and reports only summarized performance (reward). The central aggregator merges results and redistributes improved prompts.

**In Prompt Reels:**
- Each domain (e.g., news, sports, short-form reels) acts as a federated client.
- Each client tests several prompt templates using Google Gemini to describe video scenes.
- Local performance metrics (semantic similarity to known descriptions) are sent to an aggregator.
- Aggregator updates prompt priorities and distributes a new global prompt.
- Weave visualizes the improvement curve over time.

This approach enables *self-improving behavior* without retraining the model itself.

**References:**
- FedPOB: Sample-Efficient Federated Prompt Optimization via Bandits. arXiv:2509.24701 (2025)
- FedPrompt: Communication-Efficient Federated Prompt Tuning. arXiv:2208.05166 (2023)
- PromptFL: Federated Learning for Large Language Model Prompt Optimization. arXiv:2307.01961 (2023)

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
Clone the repo:
```bash
git clone https://github.com/Hack-a-tons/prompt-reels.git
cd prompt-reels
npm install
cp .env.example .env    # add Gemini and Weave keys
npm start
```

To test a local run:
```bash
node src/runLocal.js --video sample.mp4
```
Result → `output/scene_descriptions.json`

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
| **Valerii [Last name]** | AI Ops / Data / Presentation | Video sourcing, prompt testing, docs & demo |

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
MIT
