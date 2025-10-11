# Common TODO — Prompt Reels (Gemini Edition)

## Project Goal
Create a self-improving video analysis pipeline that splits videos into scenes, generates AI-based descriptions using **Google Gemini**, and iteratively improves its prompt templates through a simplified **Federated Prompt Optimization (FPO)** approach. The system must log all experiments in **W&B Weave**.

---

## Detailed Development Plan
(Updated to reflect new architecture and tool usage)

### Phase 1 — Repository & Environment Setup
- [ ] Initialize GitHub repo and push initial files.
- [ ] Create `.env.example` with `GOOGLE_API_KEY` and `WANDB_API_KEY`.
- [ ] Install dependencies: `express`, `ffmpeg-static`, `@google/generative-ai`, `weave`, `cosine-similarity`.
- [ ] Setup folder structure (`src/api`, `src/core`, `data`, `output`).
- [ ] Run basic Weave test log.

### Phase 2 — Core API Server
- [ ] Implement video upload endpoint with `multer`.
- [ ] Add ffmpeg extraction (`1 frame / 3 seconds`). 
- [ ] Integrate Gemini API to describe each frame.
- [ ] Save results as `scene_descriptions.json`.
- [ ] Log every run to Weave with prompt version and timestamp.

### Phase 3 — Prompt Optimization Loop (FPO)
- [ ] Create 3–5 prompt templates (`data/prompts.json`).
- [ ] Simulate 3 domains (news, sports, reels) as federated clients.
- [ ] Evaluate prompt performance with Gemini and embedding similarity.
- [ ] Aggregate results → update prompt weights.
- [ ] Log improvements and trends in Weave dashboard.

### Phase 4 — Optional Integrations
- [ ] **Tavily** → fetch article text for reference descriptions.
- [ ] **BrowserBase** → scrape YouTube/Reuters captions for scoring.

### Phase 5 — Client Application
- [ ] Build minimal web UI (React/Svelte).
- [ ] Upload video, display scene captions.
- [ ] Embed Weave charts to show improvement curve.

### Phase 6 — Testing & Presentation
- [ ] Validate 3–5 test videos.
- [ ] Record demo (upload → description → prompt evolution).
- [ ] Finalize slides and Weave screenshots.
- [ ] Submit to hackathon portal before 1:30 pm Sunday.

---

## Stretch Goals
- [ ] Real-time Weave visualization updates.
- [ ] Deploy on Google Cloud Run.
- [ ] Integrate multiple Gemini model variants (e.g., `gemini-1.5-pro`, `gemini-flash`). 
- [ ] Add feedback scoring UI.
- [ ] Post demo to X for “Viral on X” prize.
