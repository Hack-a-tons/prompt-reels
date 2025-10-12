# TODO — Prompt Reels

## Project Status: FEATURE COMPLETE ✅

A self-improving video analysis system with **scene detection**, **AI-powered descriptions**, and **federated prompt optimization (FPO)** with genetic evolution. Fully deployed on production.

**Last Updated**: October 12, 2025  
**Repository**: `git@github.com:Hack-a-tons/prompt-reels.git`  
**Production**: https://api.reels.hurated.com  
**Port**: 15000

---

## ✅ Completed Features

### Core Infrastructure
- [x] Express API server with health checks
- [x] Docker deployment (`docker compose up -d`)
- [x] Production deployment (reels.hurated.com)
- [x] Nginx configuration with 200MB upload limit
- [x] W&B Weave integration for experiment tracking
- [x] Azure OpenAI + Gemini dual-provider support
- [x] Comprehensive test suite (`./test.sh`)
- [x] 13+ bash scripts for automation

### Video Processing & Scene Detection
- [x] **Video upload** - multer-based with 200MB limit
- [x] **Scene detection** - ffmpeg scene filter for timestamps
- [x] **Frame extraction** - 3 frames per scene (beginning/middle/end)
- [x] **AI descriptions** - Multi-frame analysis with Azure/Gemini
- [x] **Visual scene viewer** - Beautiful HTML page with video player
- [x] **Scene JSON API** - Structured data for programmatic access
- [x] **Static file serving** - Videos and frames accessible via URL

### Scripts & Automation
- [x] `upload.sh` - Upload videos to API
- [x] `list.sh` - List uploaded videos with scene status
- [x] `detect-scenes.sh` - Fast scene timestamp detection
- [x] `describe-scenes.sh` - Extract frames + AI descriptions
- [x] `detected.sh` - Show scene detection status
- [x] `deploy.sh` - Deploy to production with Docker rebuild
- [x] `cleanup.sh` - Clean output and upload directories
- [x] `evolve.sh` - Manage FPO evolution (start/stop/status)
- [x] `show-prompts.sh` - Display prompt templates
- [x] `reset-prompts.sh` - Reset prompts to default state
- [x] `fix-nginx-upload-limit.sh` - Guide for nginx config
- [x] `free-port.sh` - Kill process on port
- [x] `run-dev.sh` - Start dev server with nodemon

### Federated Prompt Optimization (FPO)
- [x] 5+ prompt templates with performance tracking
- [x] Genetic evolution with crossover and mutation
- [x] Multi-domain simulation (news, sports, reels)
- [x] Weave logging for all evaluations
- [x] Weight-based prompt selection
- [x] Generation tracking and parent lineage
- [x] `/api/fpo/run` and `/api/fpo/status` endpoints

### Scene Viewer Features
- [x] Auto-playing video with scenes
- [x] 3 frames per scene displayed
- [x] AI-generated scene descriptions
- [x] Click timestamp to seek video
- [x] Auto-highlight current scene during playback
- [x] Responsive mobile-friendly design
- [x] Modern gradient UI with smooth animations

---

## 🔌 API Endpoints

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/health` | Health check | ✅ |
| POST | `/api/upload` | Upload video | ✅ |
| POST | `/api/analyze` | Analyze video frames | ✅ |
| POST | `/api/detect-scenes` | Detect scenes + extract frames | ✅ |
| GET | `/api/scenes/:videoId` | Visual scene viewer (HTML) | ✅ |
| GET | `/api/scenes/:videoId/json` | Scene data (JSON) | ✅ |
| GET | `/api/prompts` | Get all prompt templates | ✅ |
| GET | `/api/results/:videoId` | Get analysis results | ✅ |
| POST | `/api/fpo/run` | Run FPO optimization | ✅ |
| GET | `/api/fpo/status` | Get FPO status & weights | ✅ |

---

## 🧪 Testing

**Test Suite**: `./test.sh` with comprehensive coverage

```bash
# Test individual features
./test.sh health              # Health check
./test.sh upload              # Video upload
./test.sh detect-scenes       # Scene detection
./test.sh describe-scenes     # Frame extraction + AI
./test.sh scenes-viewer       # Scene viewer endpoints
./test.sh prompts             # Prompt management
./test.sh fpo                 # FPO optimization

# Test all features
./test.sh all                 # Run complete test suite
./test.sh -v all              # With verbose output
./test.sh -p5 all             # With 5-second pause between tests
./test.sh all dev             # Test local dev server
```

**All tests pass** ✅

---

## 📋 Complete Workflow Example

```bash
# 1. Upload video
./scripts/upload.sh ~/Downloads/video.mp4
# Returns: video-1760239791824-656504757

# 2. Detect scenes (fast - timestamps only)
./scripts/detect-scenes.sh video-1760239791824-656504757
# Output: 21 scenes detected with start/end times

# 3. Extract frames + AI descriptions (slower)
./scripts/describe-scenes.sh video-1760239791824-656504757
# Output: 63 frames + 21 AI descriptions

# 4. View in browser
# https://api.reels.hurated.com/api/scenes/video-1760239791824-656504757

# 5. Check status
./scripts/list.sh              # List all videos with scene status
./scripts/detected.sh          # Show detected scenes

# 6. Deploy changes
./scripts/deploy.sh            # Deploy to production
```

---

## 📝 Remaining Tasks (Optional Enhancements)

### Future Improvements
- [ ] **Multiple test videos per domain**
  - Create `data/test-videos/{news,sports,reels}` structure
  - Add domain-specific test videos with proper reference texts
  - Use all uploaded videos instead of just latest

- [ ] **Dashboard endpoint**
  - Create `/api/fpo/dashboard` with statistics
  - Show: avg score, min/max, trends, evaluation count
  - Add simple HTML visualization

- [ ] **Analysis script for local logs**
  - Create `scripts/analyze-weave-logs.js`
  - Group evaluations by prompt
  - Show performance trends over time

- [ ] **Client Application**
  - Build minimal web UI (React/Svelte)
  - Upload interface with drag-and-drop
  - Embed Weave charts to show improvement curve

- [ ] **External Integrations**
  - Tavily → fetch article text for reference descriptions
  - BrowserBase → scrape YouTube/Reuters captions for scoring

### Stretch Goals
- [ ] Real-time Weave visualization updates
- [ ] Deploy on Google Cloud Run
- [ ] Integrate multiple Gemini model variants (gemini-2.5-flash)
- [ ] Add feedback scoring UI
- [ ] Post demo to X for "Viral on X" prize

---

## 📚 Documentation Files

**README.md** - Complete user guide with all scripts and workflows ✅  
**TODO.md** - This file - project status and roadmap ✅  
**nginx.conf.example** - Nginx configuration template ✅  
**.env.example** - Environment variables template ✅  

---

## 🔧 Technical Notes

- **Port**: 15000 (production and dev)
- **Upload Limit**: 200MB (nginx + application)
- **Video Formats**: MP4 (extensible to others)
- **AI Providers**: Azure OpenAI (primary), Gemini (fallback)
- **Scene Detection**: ffmpeg scene filter (threshold: 0.4)
- **Frame Extraction**: 3 frames per scene (10%, 50%, 90%)
- **Logging**: W&B Weave + local JSONL fallback
- **Docker**: Multi-stage build with ffmpeg support

### Important Files
- `data/prompts.json` - Runtime state (accumulates performance history)
- `output/weave-logs/` - Local experiment logs (JSONL)
- `output/video-*_scenes.json` - Scene detection results
- `output/video-*_scenes/` - Extracted frames
- `uploads/video-*.mp4` - Uploaded videos

### Nodemon Configuration
Ignores: `data/`, `uploads/`, `output/` to prevent restarts during processing

---

## 🚀 Deployment

**Production Server**: reels.hurated.com  
**Deploy Command**: `./scripts/deploy.sh`  
**Health Check**: https://api.reels.hurated.com/health

**Deployment includes**:
- Git pull on production server
- Docker compose build
- Container restart
- Health check verification

---

## 🎯 Project Goals (Achieved)

✅ Create a self-improving video analysis pipeline  
✅ Split videos into scenes with AI descriptions  
✅ Implement Federated Prompt Optimization (FPO)  
✅ Use Gemini for image analysis  
✅ Log all experiments in W&B Weave  
✅ Provide beautiful visual scene viewer  
✅ Comprehensive automation via bash scripts  
✅ Production-ready deployment
