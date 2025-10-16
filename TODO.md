# TODO — Prompt Reels

## Project Status: FEATURE COMPLETE ✅

A self-improving video analysis system with **scene detection**, **AI-powered descriptions**, **news article fetching**, and **federated prompt optimization (FPO)** with genetic evolution. Fully deployed on production.

**Last Updated**: October 16, 2025 (Evening Update)  
**Repository**: `git@github.com:Hack-a-tons/prompt-reels.git`  
**Production**: https://reels.hurated.com  
**API**: https://api.reels.hurated.com  
**Port**: 15000

---

## ✅ Completed Features

### Core Infrastructure (Oct 11-13, 2025)
- [x] Express API server with health checks (Oct 11)
- [x] Docker deployment (`docker compose up -d`) (Oct 11)
- [x] Production deployment (reels.hurated.com) (Oct 11)
- [x] Nginx configuration with 200MB upload limit (Oct 11)
- [x] W&B Weave integration for experiment tracking (Oct 11)
- [x] Azure OpenAI + Gemini dual-provider support (Oct 11)
- [x] Comprehensive test suite (`./test.sh`) (Oct 11)
- [x] 14+ bash scripts for automation (Oct 11-13)
- [x] Cleaned up .env configuration (removed unused keys) (Oct 12)

### Video Processing & Scene Detection (Oct 11-16, 2025)
- [x] **Video upload** - multer-based with 200MB limit (Oct 11)
- [x] **Scene detection** - ffmpeg scene filter for timestamps (Oct 11)
- [x] **Frame extraction** - 3 frames per scene (beginning/middle/end) (Oct 11)
- [x] **AI descriptions** - Multi-frame analysis with Azure/Gemini (Oct 11)
- [x] **Visual scene viewer** - Beautiful HTML page with video player (Oct 11)
- [x] **Scene JSON API** - Structured data for programmatic access (Oct 11)
- [x] **Static file serving** - Videos and frames accessible via URL (Oct 11)
- [x] **Audio transcription** - Whisper API integration (Oct 16)
- [x] **Language detection** - Auto-detect from audio, 20+ languages (Oct 16)
- [x] **Multi-format support** - MP4, MOV, AVI, MKV, WEBM (Oct 16)

### News Article Fetching (Oct 12-13, 2025) ✨
- [x] **Tavily integration** - Search for news articles with videos (Oct 12)
- [x] **Automatic RSS fallback** - Falls back to 13 RSS feeds when Tavily fails (Oct 13)
- [x] **Manual URL input** - Fetch specific articles via URL (`fetch-from-url.sh`) (Oct 13)
- [x] **BrowserBase integration** - Extract video URLs from articles (Oct 12)
- [x] **Automatic video download** - Direct video downloads to `uploads/articles/` (Oct 12)
- [x] **Rich metadata** - Article title, text, source, timestamps (Oct 12)
- [x] **Article listing API** - GET `/api/articles` and `/api/articles/:id` (Oct 12)
- [x] **fetch-news.sh** - CLI script for fetching articles (Oct 12)
- [x] `list.sh articles` - List fetched articles with metadata (Oct 12)

### Scripts & Automation
- [x] `upload.sh` - Upload videos to API
- [x] `list.sh` - **FIXED:** List videos/articles (now finds article-*.mp4)
- [x] `detect-scenes.sh` - Fast scene timestamp detection
- [x] `describe-scenes.sh` - Extract frames + AI descriptions
- [x] `detected.sh` - Show scene detection status
- [x] `fetch-news.sh` - Fetch news articles with videos
- [x] `status.sh` - Monitor queues, flags, and processing status
- [x] `evolve.sh` - **ENHANCED:** Run FPO with flexible syntax (10, -n 10, -n10), random article selection
- [x] `fpo-history.sh` - View FPO optimization history with prompt templates
- [x] `generate-thumbnails.sh` - **NEW:** Create lightweight video thumbnails for dashboard
- [x] `deploy.sh` - Deploy to production with Docker rebuild
- [x] **Dashboard video thumbnails** - Auto-playing 160x90px previews (Oct 12)
- [x] **Score color coding** - Red/yellow/green for match scores (Oct 12)
- [x] **Multiline titles** - Up to 3 lines for better readability (Oct 12)
- [x] **Markdown rendering** - Proper formatting on article pages (Oct 12)
- [x] **Fixed multiline links** - Links normalize correctly (Oct 12)
- [x] **Dark mode everywhere** - Consistent across all pages (Oct 12)
- [x] **Buttons hide immediately** - On click, shows spinners (Oct 12)
- [x] **Bigger FPO button** - Prominent "Run FPO Iteration" button (Oct 12)
- [x] **Prompts page color coding** - **FIXED:** Green only for > baseline, red for < baseline (Oct 12)
- [x] **FPO button auto-disables** - Hides when script runs, polls every 3s (Oct 12)
- [x] **Analyze page** - Upload and process videos via web UI (Oct 16)
- [x] **Videos gallery** - Browse all processed videos (Oct 16)
- [x] **Video title in headers** - AI-generated titles in page headers (Oct 16)
- [x] **Comprehensive timing logs** - Track processing time for each stage (Oct 16)

### Queue & Background Processing (Oct 12, 2025)
- [x] **Persistent queue system** - Survives Docker restarts (data/queues/) (Oct 12)
- [x] **Four queue types** - Fetch, Describe, Rate, FPO (Oct 12)
- [x] **Concurrent processing** - Up to 4 workers (1 per type) (Oct 12)
- [x] **Auto-retry** - Failed items retry up to 3 times (Oct 12)
- [x] **Queue status API** - GET /api/queue/status (Oct 12)
- [x] **status.sh script** - Monitor queues and flags (Oct 12)
- [x] **Flag system** - Prevents duplicate operations (/tmp/prompt-reels-flags/) (Oct 12)

### Video Optimization (Oct 12-16, 2025)
- [x] **Range request support** - Fast video seeking (Oct 12)
- [x] **Local video playback** - All pages use downloaded videos (Oct 12)
- [x] **Whisper rate limiting** - 3 req/min, proactive waiting (Oct 16)
- [x] **Video thumbnails** - Lightweight previews for dashboard (1-2 MB vs 50-400 MB) (Oct 12)
- [x] **Auto-thumbnail generation** - Created automatically on video download (Oct 12)
- [x] **Thumbnail fallback** - Uses full video if thumbnail doesn't exist (Oct 12)
- [x] **generate-thumbnails.sh** - Script to create thumbnails for existing videos (Oct 12)
- [x] **Upload retry with exponential backoff** - 3 automatic retries on network failure (Oct 16)
- [x] **60-second timeout detection** - Catches stalled connections during upload (Oct 16)

### FPO Improvements (Oct 11-12, 2025)
- [x] **Automatic FPO on rating** - Runs when articles rated (Oct 12)
- [x] **Manual FPO button** - On prompts page (Oct 12)
- [x] **Uses real article data** - No more "No test data available" (Oct 12)
- [x] **Finds described articles** - 13+ articles with frames (Oct 12)
- [x] **Semantic similarity scoring** - Real scores, not 0.0000 (Oct 12)
- [x] **Fixed test data lookup** - Uses article-*_frames/ structure (Oct 12)
- [x] **evolve.sh enhanced** - Flexible syntax (10, -n 10, -n10), merged with run-fpo.sh (Oct 11)
- [x] **Random article selection** - Each iteration uses different article/scene/frame (Oct 12)
- [x] **Improved diversity** - Better generalization, less overfitting (Oct 12)
- [x] **fpo-history.sh shows templates** - View prompts with their actual text (Oct 11)
- [x] **Single prompt set** - Same 5 prompts for scene description AND matching (Oct 12)
- [x] **Genetic evolution** - Creates new prompts every 2 iterations (Oct 11)
- [x] **Auto-used best prompt** - Top-ranked prompt automatically used everywhere (Oct 12)

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
| GET | `/api/flags/status` | Get flag status (temp locks) | ✅ |
| GET | `/api/queue/status` | Get queue status (persistent) | ✅ |
| GET | `/api/articles/:id.mp4` | Stream video with range support | ✅ |
| GET | `/prompts` | Prompts optimization history page | ✅ |
| GET | `/articles/:id` | Article detail page with markdown | ✅ |
| GET | `/` | Dashboard with video thumbnails | ✅ |

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

## 📝 NEW FEATURES - USER EXPERIENCE IMPROVEMENTS

### Recently Added (Oct 16, 2025)
- [x] AI-generated scene titles (combining visual + dialogue)
- [x] AI-generated video titles (overall summary)
- [x] Comprehensive timing logs for all processing stages
- [x] Video title and ID in timing summary logs
- [x] Video title in Scene Viewer page header (replaces "Scene Viewer")
- [x] Transcript formatting with AI (punctuation, paragraphs, emphasis)
- [x] Cookie-parser integration (foundation for ownership)

---

## 🚀 PHASE 4: TEXT ENHANCEMENT (Next Priority)
**Status:** Ready to implement  
**Time Estimate:** 1-2 hours total

### A. Clickable URLs and Emails (30 minutes)
- [ ] Auto-detect URLs in transcripts and descriptions
- [ ] Make URLs clickable with `target="_blank"`
- [ ] Auto-detect email addresses
- [ ] Make emails clickable with `mailto:` links
- [ ] Remove blue color from non-link text
- [ ] Only make URLs/emails blue

**Implementation:**
```javascript
function linkifyText(text) {
  // URLs
  text = text.replace(/(https?:\/\/[^\s]+)/g, 
    '<a href="$1" target="_blank" style="color: #1d9bf0;">$1</a>');
  
  // Emails
  text = text.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g,
    '<a href="mailto:$1" style="color: #1d9bf0;">$1</a>');
  
  return text;
}
```

### B. Field Type Separation (1 hour)
Special formatting for different field types:

- [ ] **Names** - Proper capitalization, bold
  - Pattern: `@([A-Z][a-z]+ [A-Z][a-z]+)` or context-based
  - Example: "john smith" → "**John Smith**"

- [ ] **URLs** - Clickable, blue (see above)
  - Pattern: `(https?://[^\s]+)`

- [ ] **Emails** - Clickable, blue (see above)  
  - Pattern: `([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)`

- [ ] **App/Script Names** - Monospace font, light background
  - Pattern: `([a-zA-Z0-9_-]+\.(sh|js|py|rb|go|rs|ts|tsx|jsx|cpp|c|h|java|kt|swift|m|mm|php|pl))`
  - Example: `test.sh` → `<code>test.sh</code>`
  - Common executables: npm, git, docker, ffmpeg, python, node

**CSS:**
```css
.description code {
  font-family: 'Courier New', monospace;
  background: rgba(110, 118, 125, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}
```

---

## 🔧 PHASE 5: OWNERSHIP & EDITING (Medium Priority)
**Status:** Cookie-parser ready, implementation needed  
**Time Estimate:** 3-4 hours total

### A. Cookie-Based Ownership (1 hour)
- [ ] Generate unique user ID on first visit
- [ ] Store user ID in cookie (365 days, httpOnly, sameSite=lax)
- [ ] Add `ownerId` field to scene JSON on upload
- [ ] Check ownership when displaying videos
- [ ] Show "My Videos" vs "All Videos" filter on videos page
- [ ] Add ownership indicator badge

**Security:**
```javascript
res.cookie('userId', userId, {
  maxAge: 365 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: false,  // true in production
  sameSite: 'lax'
});
```

### B. Edit Capability (1.5 hours)
- [ ] Add "✏️ Edit" button (only visible for owned videos)
- [ ] Inline editing for video title
- [ ] Inline editing for scene titles
- [ ] Textarea editing for scene descriptions
- [ ] Textarea editing for transcripts (separated by field type)
- [ ] "💾 Save" / "❌ Cancel" buttons
- [ ] POST `/api/edit/:videoId` endpoint
- [ ] Update JSON file on save
- [ ] Authorization check via cookie

**UI:**
```
[Video Title]  [✏️ Edit]
                 ↓
[Input field]  [💾 Save] [❌ Cancel]
```

### C. Delete Capability (30 minutes)
- [ ] Add "🗑️ Delete Video" button (only for owned videos)
- [ ] Confirmation dialog: "Delete this video? Cannot be undone."
- [ ] DELETE `/api/delete/:videoId` endpoint
- [ ] Check ownership via cookie (403 if not owner)
- [ ] Delete all files:
  - Video file (`uploads/video-*.mp4`)
  - Thumbnail (`uploads/video-*-thumb.jpg`)
  - Scene frames directory (`output/video-*_scenes/`)
  - Scene JSON (`output/video-*_scenes.json`)
- [ ] Redirect to videos page after deletion

---

## 🏗️ PHASE 6: PROCESSING PIPELINE SEPARATION (High Priority)
**Status:** Major architectural change  
**Time Estimate:** 5-6 hours total

### Problem
Currently everything runs in one workflow:
```
Upload → Scene Detection → Frame Extraction → Transcription → Descriptions
```

If you want to change language or threshold, you must redo everything.

### Solution: Stateful Processing

#### Step 1: Add Processing State to JSON (1 hour)
```json
{
  "videoId": "video-123",
  "title": "Team Meeting",
  "ownerId": "abc123",
  "processingState": {
    "upload": {
      "completed": true,
      "timestamp": "2025-10-16T12:00:00Z",
      "data": { "filename": "video-123.mp4", "size": 15728640 }
    },
    "sceneDetection": {
      "completed": true,
      "timestamp": "2025-10-16T12:00:15Z",
      "params": { "threshold": 0.4 },
      "data": { "sceneCount": 12 }
    },
    "frameExtraction": { "completed": true, "timestamp": "..." },
    "transcription": {
      "completed": true,
      "params": { "language": "Russian", "autoDetected": true }
    },
    "descriptions": {
      "completed": true,
      "params": { "language": "Russian" }
    }
  }
}
```

#### Step 2: Create Reprocessing Endpoints (2 hours)
- [ ] POST `/api/reprocess/:videoId` with body:
  ```json
  {
    "from": "transcription",
    "params": {
      "language": "English",
      "threshold": 0.3
    }
  }
  ```
- [ ] Validate ownership before reprocessing
- [ ] Clear dependent steps (e.g., if redoing transcription, clear descriptions too)
- [ ] Run from specified step onwards
- [ ] Update processing state after each step

#### Step 3: Add UI Controls (2 hours)
- [ ] Show processing state indicators (✅ complete, ⏸️ incomplete)
- [ ] Add "Reprocess from..." dropdown (only for owners)
- [ ] Options:
  - "Scene Detection" (with threshold slider)
  - "Transcription" (with language selector)
  - "Descriptions" (inherits language)
- [ ] Confirmation dialog: "This will redo steps X, Y, Z. Continue?"
- [ ] Progress indicator during reprocessing
- [ ] Auto-refresh page when complete

#### Step 4: Refactor Code (1 hour)
- [ ] Extract each processing step into separate async function
- [ ] Make steps idempotent (can run multiple times safely)
- [ ] Add step dependency checking
- [ ] Update timing logs to show skipped steps

**Benefits:**
- ✅ Don't re-upload video when changing language
- ✅ Faster iterations (skip completed steps)
- ✅ Save API costs
- ✅ Experiment with different parameters easily

---

## 🎬 PHASE 7: FFMPEG PROGRESS TRACKING (Medium Priority)
**Status:** Complex but valuable  
**Time Estimate:** 2-3 hours

### Problem
Scene detection shows no progress:
```
🎬 Detecting scenes...
(long wait with no feedback)
✓ Detected 12 scenes (45.2s)
```

### Solution: Parse FFmpeg Output

#### A. Get Total Frame Count (15 minutes)
```bash
ffprobe -v error -select_streams v:0 -count_packets \
  -show_entries stream=nb_read_packets -of csv=p=0 video.mp4
```

#### B. Parse FFmpeg stderr (1 hour)
```javascript
const ffmpeg = spawn('ffmpeg', [...]);
const totalFrames = getTotalFrames(videoPath);

ffmpeg.stderr.on('data', (data) => {
  const match = data.toString().match(/frame=\s*(\d+)/);
  if (match) {
    const progress = (parseInt(match[1]) / totalFrames * 100).toFixed(1);
    console.log(`Progress: ${progress}%`);
  }
});
```

#### C. Real-Time Updates (1 hour)
- [ ] Implement Server-Sent Events (SSE) for progress
- [ ] Endpoint: GET `/api/progress/:videoId`
- [ ] Client: `EventSource` to receive updates
- [ ] Update analyze page with progress bar
- [ ] Show: "Detecting scenes: 45% (frame 1234/2748)"
- [ ] ETA calculation based on FPS

#### D. UI Progress Bar (30 minutes)
- [ ] Add progress bar component
- [ ] Color-code by stage (blue=detection, green=extraction, etc.)
- [ ] Show current operation and percentage
- [ ] Smooth animations

---

## 📋 IMPLEMENTATION PRIORITY

| Phase | Feature | Priority | Time | Complexity | Status |
|-------|---------|----------|------|------------|--------|
| 4 | Clickable URLs/emails | High | 30min | Low | ⏳ Next |
| 4 | Field type separation | High | 1hr | Low | ⏳ Next |
| 5 | Cookie ownership | High | 1hr | Medium | ⏳ Ready |
| 5 | Edit capability | Medium | 1.5hr | Medium | ⏳ Planned |
| 5 | Delete capability | High | 30min | Medium | ⏳ Planned |
| 6 | Processing pipeline | High | 5-6hr | High | ⏳ Planned |
| 7 | FFmpeg progress | Medium | 2-3hr | High | ⏳ Future |

**Total Time:** 11-14 hours

---

## 🎯 INCREMENTAL WORKFLOW

### Session 1: Text Enhancement (1-2 hours)
1. Implement clickable URLs and emails
2. Add field type separation (names, scripts, etc.)
3. Test on existing videos
4. Deploy to production

**Outcome:** Better text readability and usability

### Session 2: Ownership (2-3 hours)
1. Cookie-based ownership tracking
2. Edit capability for owned videos
3. Delete capability with confirmation
4. Test with multiple "users" (different browsers)
5. Deploy to production

**Outcome:** User control over their videos

### Session 3: Pipeline Refactor (5-6 hours)
1. Add processing state to JSON structure
2. Create reprocessing endpoints
3. Add UI controls for step selection
4. Test reprocessing from different steps
5. Deploy to production

**Outcome:** Flexible re-processing without re-uploading

### Session 4: Progress Tracking (2-3 hours)
1. Implement FFmpeg progress parsing
2. Add SSE for real-time updates
3. Create progress bar UI
4. Test with long videos
5. Deploy to production

**Outcome:** User sees real-time progress

---

## 🐛 KNOWN ISSUES TO ADDRESS

### Issue 1: Frontend/Backend Desync
**Problem:** Analyze page shows fake progress while backend processes

**Root Cause:**
```
Frontend: Upload → fake "Detecting" → fake "Extracting" → Timeout ❌
Backend:  Upload → (waiting) → Detecting → Extracting → Complete ✅
```

**Solution:** Phase 7 (SSE progress) will fix this

### Issue 2: Scene Detection Timeouts on Long Videos
**Problem:** Videos > 1 hour may timeout

**Solution:**
- Add duration check on upload
- Warn if > 60 minutes
- Consider chunked processing

### Issue 3: Concurrent Uploads
**Problem:** Multiple simultaneous uploads may overload server

**Solution:**
- Add upload queue system
- Limit concurrent ffmpeg processes
- Show queue position to user

---

## 📝 REMAINING TASKS (Original List)

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
- [ ] Batch video upload (multiple files)
- [ ] Export scenes to JSON/CSV/PDF
- [ ] Share videos with unique URLs
- [ ] Public vs private videos
- [ ] Video statistics dashboard
- [ ] Search across all videos
- [ ] Tags/categories for videos

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

### Storage Locations
- **User uploaded videos**: `./uploads/` (format: `video-{timestamp}-{random}.mp4`)
- **Article videos**: `./uploads/articles/` (format: `article-{timestamp}-{random}.mp4`)
- **Scene data**: `./output/` (scene detection results, frames)
- **Prompt data**: `./data/prompts.json` (FPO optimization state)
- **Environment**: `UPLOAD_DIR`, `OUTPUT_DIR`, `DATA_DIR` in config

### API Logging
All API calls logged with:
- **Format**: `[icon] YYYY-MM-DD HH:MM:SS IP METHOD PATH → STATUS TIME`
- **Icons**: ✓ (2xx), ↪️ (3xx), ⚠️ (4xx), ❌ (5xx)
- **IP Detection**: X-Forwarded-For, X-Real-IP, or socket (works behind nginx)
- **Excluded**: `/health`, static files (`/uploads/*`, `/output/*`)
- **Max line**: 140 characters

### Tavily Alternatives
When Tavily API hits limits (HTTP 432):
1. **Automatic RSS fallback** - 13 major news sources (CNN, NBC, BBC, etc.)
2. **Manual URL input** - `./scripts/fetch-from-url.sh <URL>` or POST `/api/fetch-from-url`
3. **RSS sources**: Free, no API keys needed, gets latest news from major outlets

### Recent Bug Fixes
- **Fixed** `/videos` page error - Added missing `fs` module import
- **Added** upload retry logic - 3 attempts with exponential backoff (2s, 4s, 8s)
- **Added** 60-second timeout detection for stalled uploads
- **Added** network error recovery with user-friendly retry messages

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
