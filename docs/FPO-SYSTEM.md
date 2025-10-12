# FPO System Explained

## Overview

**FPO (Federated Prompt Optimization)** optimizes a **single set of prompts** that are used for **TWO different tasks**:
1. 🎬 **Scene Description** - Describing video frames
2. ⭐ **Video-Article Matching** - Rating how well videos match articles

## The Key Insight

**YOU DON'T OPTIMIZE SEPARATE PROMPTS FOR EACH TASK!**

Instead:
- You have **ONE set of 5 prompt templates**
- They're evaluated on **article data** (video frames + article text)
- The **SAME prompts** are used for BOTH tasks
- The system ranks them by **overall performance**

## How FPO Works

### 1. The 5 Original Prompts

Located in `data/prompts.json`:

```json
{
  "templates": [
    {
      "id": "baseline",
      "name": "Baseline Description",
      "template": "Describe what you see in this video frame in detail.",
      "weight": 1.0,
      "performance": []
    },
    {
      "id": "structured",
      "name": "Structured Analysis",
      "template": "Analyze this video frame and provide: 1) Main subjects, 2) Actions occurring, 3) Setting/environment, 4) Notable details.",
      "weight": 1.0,
      "performance": []
    },
    {
      "id": "narrative",
      "name": "Narrative Style",
      "template": "Describe this scene as if you're narrating a story. What's happening, who's involved, and what's the context?",
      "weight": 1.0,
      "performance": []
    },
    {
      "id": "technical",
      "name": "Technical Details",
      "template": "Provide a technical description of this frame including: composition, lighting, subjects, actions, and any text visible.",
      "weight": 1.0,
      "performance": []
    },
    {
      "id": "comprehensive",
      "name": "Comprehensive Analysis",
      "template": "Analyze this video frame comprehensively: describe the scene, identify all subjects and objects, explain what actions are taking place, note the setting and atmosphere, and mention any text or graphics visible.",
      "weight": 1.0,
      "performance": []
    }
  ]
}
```

### 2. How Each Iteration Works

When you run `./scripts/run-fpo.sh 10`:

```
FOR EACH of 10 iterations:
  1. Pick a RANDOM article/scene/frame
  2. FOR EACH prompt (baseline, structured, narrative, technical, comprehensive):
     a. Generate description using this prompt
     b. Compare description to article text (semantic similarity)
     c. Calculate score (0-1)
     d. Save score to prompt's performance[] array
  3. Re-rank all prompts by average score
  4. Every 2 iterations: Run genetic evolution (create new prompts by combining best ones)
```

**Total evaluations:** 5 prompts × 10 iterations = **50 API calls**

### 3. How Prompts Are Used for Both Tasks

#### Task 1: Scene Description 🎬

When describing scenes (`describe-scenes.sh`):

```javascript
// The system uses the BEST prompt based on FPO rankings
const bestPrompt = prompts.templates
  .sort((a, b) => b.weight - a.weight)[0];

// Then describes each frame
const description = await describeImage(
  framePath, 
  bestPrompt.template  // ← Uses optimized prompt!
);
```

#### Task 2: Video-Article Matching ⭐

When rating article-video match (`rate-article.sh`):

```javascript
// Also uses the BEST prompt
const bestPrompt = prompts.templates
  .sort((a, b) => b.weight - a.weight)[0];

// Generates match rating
const matchScore = await rateVideoArticleMatch(
  article,
  sceneDescriptions,
  bestPrompt.template  // ← Same optimized prompt!
);
```

**The same prompts work for both because:**
- Better scene descriptions → Better understanding of video
- Better understanding → Better match ratings
- Prompts that describe well also rate well

## Viewing Optimized Prompts

### 1. Via Web UI

Go to: https://reels.hurated.com/prompts

**You'll see TWO tabs:**
- 🎬 **Scene Description** tab
- ⭐ **Video-Article Match** tab

**BOTH TABS SHOW THE SAME PROMPTS!**

They're just labeled differently for clarity:
- Scene Description: "Here are the prompts used to describe frames"
- Video-Article Match: "Here are the prompts used to rate matches"

But it's the **same data** - same 5 prompts, same scores, same rankings.

**Color Coding:**
- 🏆 **Top Prompt** - Gold badge "BEST"
- 🟢 **Green (+X%)** - Better than baseline
- 🔴 **Red (-X%)** - Worse than baseline
- ⚪ **No color** - Is baseline (no comparison)

### 2. Via Command Line

```bash
# View FPO history
./scripts/fpo-history.sh

# With details
./scripts/fpo-history.sh -d

# Top 3 only
./scripts/fpo-history.sh -n 3
```

**Example output:**
```
=== FPO Optimization History (prod) ===

📊 Overview
   Global Prompt: comprehensive
   Total Prompts: 5

🧬 Population Composition
   Generation 0 (Original): 5
   Generation 1+ (Evolved): 0

🏆 Top 5 Prompts (by weight)

🏆 #1 comprehensive [Original]
   Weight: 0.000245
   Samples: 10 | Avg Score: 0.8567

🥈 #2 structured [Original]
   Weight: 0.000230
   Samples: 10 | Avg Score: 0.8412

🥉 #3 technical [Original]
   Weight: 0.000215
   Samples: 10 | Avg Score: 0.8245
```

### 3. Via Direct File Access

```bash
# View prompts file
cat data/prompts.json | jq .

# See which prompt is currently "best"
cat data/prompts.json | jq '.global_prompt'

# See all prompts sorted by weight
cat data/prompts.json | jq '.templates | sort_by(-.weight) | .[] | {id, weight, samples: (.performance | length)}'
```

## Using the Best Prompt

### Automatic Usage

**The system ALREADY uses the best prompt automatically!**

When you run:
```bash
# Describe scenes
./scripts/describe-scenes.sh article-123

# Rate article
curl -X POST /api/articles/article-123/rate
```

Both operations automatically:
1. Load `data/prompts.json`
2. Find prompt with highest `weight`
3. Use that prompt for the operation

**You don't need to do anything manually!**

### Manual Override

If you want to force a specific prompt (for testing):

```javascript
// In your code
const { loadPrompts } = require('./core/promptOptimizer');
const prompts = loadPrompts();

// Use specific prompt by ID
const specificPrompt = prompts.templates.find(t => t.id === 'narrative');

// Or use the best one (default behavior)
const bestPrompt = prompts.templates.sort((a, b) => b.weight - a.weight)[0];
```

### Check Which Prompt Is Being Used

```bash
# Check global_prompt setting
cat data/prompts.json | jq '.global_prompt'

# Output: "comprehensive" (for example)
```

This is updated automatically after each FPO run.

## FAQ

### Q: Why do both tabs show the same prompts?

**A:** Because we optimize ONE set of prompts that work for BOTH tasks. Better descriptions lead to better matching, so the same prompts excel at both.

### Q: How do I know which prompt is best for scene description vs matching?

**A:** You don't need to! The top-ranked prompt (🏆 BEST) is best for BOTH tasks. That's the whole point of FPO - finding prompts that work well across all tasks.

### Q: Can I have different prompts for each task?

**A:** Technically yes, but it defeats the purpose of FPO. The current system is designed to find **general-purpose prompts** that work well everywhere.

### Q: How often should I run FPO?

**A:** 
- **Initial:** Run 20-30 iterations to establish good baselines
- **Periodic:** Run 5-10 iterations after every 10 new articles
- **Automatic:** FPO runs automatically when you rate articles

### Q: When will I see evolved prompts?

**A:** Evolution runs every 2 iterations (when evolution is enabled). After 10 iterations, you'll have ~5 evolved prompts (Generation 1). They appear alongside originals in rankings.

### Q: How do I use the best prompt?

**A:** You already are! The system automatically uses the top-ranked prompt (by weight) for all operations. No manual intervention needed.

## Workflow Example

```bash
# 1. Add and process articles
./scripts/fetch-news.sh -n 5
# (Automatically describes scenes using best prompt)

# 2. Rate articles  
# Go to dashboard → Click "Rate Match"
# (Automatically uses best prompt for rating)

# 3. Run FPO optimization
./scripts/run-fpo.sh 10
# (Evaluates all prompts, updates rankings)

# 4. Check which prompt is best
./scripts/fpo-history.sh

# 5. Process more articles
./scripts/describe-scenes.sh article-XYZ
# (Now uses updated best prompt!)

# 6. Repeat...
```

## Summary

- ✅ **Single set of prompts** for all tasks
- ✅ **Same prompts** shown on both tabs
- ✅ **Automatically used** - no manual selection needed
- ✅ **Ranked by performance** - best prompt = highest weight
- ✅ **Continuously improving** - run FPO periodically
- ✅ **View anytime** - Web UI or `fpo-history.sh`

**You don't optimize for two cases separately - you optimize ONE set of prompts that works well for BOTH cases!** 🎯
