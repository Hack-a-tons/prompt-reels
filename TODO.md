# Common TODO — Prompt Reels (Gemini Edition)

## Project Goal
Create a self-improving video analysis pipeline that splits videos into scenes, generates AI-based descriptions using **Google Gemini**, and iteratively improves its prompt templates through a simplified **Federated Prompt Optimization (FPO)** approach. The system must log all experiments in **W&B Weave**.

---

## Detailed Development Plan
(Updated to reflect new architecture and tool usage)

### Phase 1 — Repository & Environment Setup ✅
- [x] Initialize GitHub repo and push initial files.
- [x] Create `.env.example` with `GOOGLE_API_KEY` and `WANDB_API_KEY`.
- [x] Install dependencies: `express`, `ffmpeg-static`, `@google/generative-ai`, `cosine-similarity`.
- [x] Setup folder structure (`src/api`, `src/core`, `data`, `output`).
- [x] Created Weave logging system (file-based).
- [x] Integrated W&B Weave SDK with cloud logging.
- [x] Created `test.sh` script with `-v` and `-p` flags.
- [x] Created `Dockerfile` and `compose.yml` for production.
- [x] Server running on port 15000 with health check.
- [x] Basic API endpoints: upload, analyze, prompts, FPO.
- [x] Deployed to production (reels.hurated.com).

### Phase 2 — Core API Server
- [ ] Test video upload endpoint with `multer` (already implemented).
- [ ] Test ffmpeg extraction (`1 frame / 3 seconds`) with real video.
- [ ] Test Gemini API to describe each frame.
- [ ] Save results as `scene_descriptions.json`.
- [ ] Log every run to Weave with prompt version and timestamp.
- [ ] Find 3-5 short test videos (Pexels, Pixabay, Reuters) for different domains.
- [ ] Create `data/reference.json` with ground-truth descriptions for evaluation.

### Phase 3 — Prompt Optimization Loop (FPO) ✅
- [x] Create 3–5 prompt templates (`data/prompts.json`).
- [x] Simulate 3 domains (news, sports, reels) as federated clients.
- [x] Evaluate prompt performance with Gemini and embedding similarity.
- [x] Aggregate results → update prompt weights.
- [x] Log improvements and trends in Weave dashboard.
- [x] Implement genetic crossover for prompt evolution.
- [x] Track generation numbers and parent lineage.
- [x] Create evolve.sh management script.

### Phase 4 — Optional Integrations
- [ ] **Tavily** → fetch article text for reference descriptions.
- [ ] **BrowserBase** → scrape YouTube/Reuters captions for scoring.

### Phase 5 — Client Application
- [ ] Build minimal web UI (React/Svelte).
- [ ] Upload video, display scene captions.
- [ ] Embed Weave charts to show improvement curve.

### Phase 6 — Testing & Presentation
- [ ] Validate 3–5 test videos across domains (news, sports, reels).
- [ ] Record demo (upload → description → prompt evolution).
- [ ] Create presentation slides (Problem, Solution, Demo, Results).
- [ ] Include Weave dashboard screenshots and "prompt improvement" chart.
- [ ] Write demo script (≤ 1 min spoken narration).
- [ ] Prepare submission text (Project summary, Tech stack, Prizes targeted).
- [ ] Submit to hackathon portal before 1:30 pm Sunday.
- [ ] Post demo clip on X for "Viral on X" prize.

---

## Next Steps - FPO Improvements

### High Priority
- [ ] **Scene-based frame extraction** ← IN PROGRESS
  - [ ] Detect scene changes using ffmpeg (scene filter)
  - [ ] Return JSON with scene timestamps (start, end)
  - [ ] Extract 3 frames per scene (beginning, middle, end)
  - [ ] Analyze 3 frames together for better context
  - [ ] API endpoint: POST /api/detect-scenes
  - [ ] Bash script: scripts/detect-scenes.sh
  - **Impact**: Significantly improves data quality and scoring accuracy

- [ ] **Multiple test videos per domain**
  - Create `data/test-videos/{news,sports,reels}` structure
  - Add domain-specific test videos with proper reference texts
  - Use all uploaded videos instead of just latest
  - **Impact**: Better evaluation coverage across content types

- [ ] **Dashboard endpoint**
  - Create `/api/fpo/dashboard` with statistics
  - Show: avg score, min/max, trends, evaluation count
  - Add simple HTML visualization
  - **Impact**: Easy to see current best prompt and trends

### Medium Priority
- [x] **Real W&B Weave integration** ✅
  - Installed `@wandb/sdk`
  - Implemented cloud logging with file fallback
  - View experiments at https://wandb.ai/prompt-reels
  - **Impact**: Better visualization and collaboration

- [ ] **Analysis script for local logs**
  - Create `scripts/analyze-weave-logs.js`
  - Group evaluations by prompt
  - Show performance trends over time
  - **Impact**: Understand current data without W&B cloud

### Stretch Goals
- [ ] Real-time Weave visualization updates
- [ ] Deploy on Google Cloud Run
- [ ] Integrate multiple Gemini model variants (e.g., `gemini-2.5-pro`, `gemini-2.5-flash`)
- [ ] Add feedback scoring UI
- [ ] Post demo to X for "Viral on X" prize

---

## Current Status

**Last Updated**: October 11, 2025  
**Repository**: `git@github.com:Hack-a-tons/prompt-reels.git`  
**Port**: 15000 (available on production server)  
**Domain**: reels.hurated.com

### What's Working
- Express API server on port 15000
- Health check: `GET /health`
- API endpoints: upload, analyze, prompts, FPO
- Weave logging to `output/weave-logs/` (JSONL format)
- Test script: `./test.sh` with `-v` and `-p` flags
- Docker ready: `docker compose up -d`
- Gemini + Azure OpenAI fallback configured

### API Endpoints
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/health` | Working |
| POST | `/api/upload` | Ready |
| POST | `/api/analyze` | Ready |
| GET | `/api/prompts` | Working |
| GET | `/api/results/:videoId` | Ready |
| POST | `/api/fpo/run` | Ready |
| GET | `/api/fpo/status` | Ready |

### Test Results
```bash
./test.sh health -v     # Returns 200 with config
./test.sh prompts -v    # Returns 5 templates
```

---

## Git Commit

Ready to commit Phase 1:
```bash
git add .
git commit -m "Phase 1: Complete basic infrastructure

- Set up Express API server with health check
- Integrate Google Gemini for image description  
- Implement video processing with ffmpeg
- Create FPO (Federated Prompt Optimization) system
- Add Weave logging for experiment tracking
- Configure Docker deployment with compose.yml
- Create test.sh script with -v and -p flags
- Add Azure OpenAI as fallback option
- Port 15000, domain: reels.hurated.com"

git push origin main
```

### Files to Commit
- Configuration: `.env.example`, `.gitignore`, `.dockerignore`
- Code: `package.json`, `src/`, `data/`
- Deployment: `Dockerfile`, `compose.yml`
- Testing: `test.sh`
- Docs: `README.md`, `TODO.md`

---

## Notes
- `.env` gitignored (contains real API keys)
- Weave: File-based logging (JSONL) until official SDK integrated
- ffmpeg: Bundled via ffmpeg-static
- Video uploads: 100MB limit (configurable)
- Test flags: `-pv`, `-vp`, `-p5`, etc. all work
- Keep code lightweight and modular
- Test videos and reference data go in `/data/`
- Presentation materials go in `/slides/`
- Save all output under `/output/` for demo
- **Important:** `data/prompts.json` is runtime state (accumulates performance history). Use `npm run reset-prompts` before committing for clean state
- **Nodemon:** Configured to ignore `data/`, `uploads/`, `output/` to prevent restarts during FPO runs and video processing
