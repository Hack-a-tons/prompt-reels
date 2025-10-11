# Prompt Reels 🎥
### A Self-Improving Video Description Agent

**Prompt Reels** automatically splits videos into scenes, describes each scene with **Google Gemini**, and improves its own prompt instructions over time through a federated-style optimization loop.  
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
