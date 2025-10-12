# Prompt Evolution Guide 🧬

Complete guide to the self-improving prompt system.

---

## 📍 Where Evolved Prompts Are Stored

**Location:** `data/prompts.json`

### Structure:
```json
{
  "version": "1.0.0",
  "templates": [
    {
      "id": "baseline",
      "name": "Baseline Description",
      "template": "Describe what you see...",
      "weight": 0.023,
      "generation": 0,
      "performance": [...]
    },
    {
      "id": "evolved_gen1_abc123",
      "name": "Evolved Gen 1",
      "template": "Describe in detail what you see...",
      "weight": 0.041,
      "generation": 1,
      "parents": ["baseline", "technical"],
      "created": "2025-10-12T01:30:00.000Z",
      "performance": [...]
    }
  ],
  "domains": ["news", "sports", "reels"],
  "global_prompt": "evolved_gen1_abc123"
}
```

### Key Fields:
- **`generation`**: 0 = original, 1+ = evolved
- **`parents`**: IDs of parent prompts used in crossover
- **`weight`**: Current performance score (higher = better)
- **`performance`**: History of scores from all iterations
- **`created`**: When the evolved prompt was created

---

## 🔧 API Endpoints

### 1. Start Evolution

**Endpoint:** `POST /api/fpo/run`

**Request:**
```json
{
  "iterations": 5,
  "enableEvolution": true,
  "evolutionInterval": 2
}
```

**Response:**
```json
{
  "success": true,
  "iterations": 5,
  "finalPrompt": "evolved_gen2_xyz",
  "evolved": 2,
  "generation": 2,
  "results": [...]
}
```

**Parameters:**
- `iterations` (number): How many rounds to run (default: 3)
- `enableEvolution` (boolean): Enable genetic crossover (default: true)
- `evolutionInterval` (number): Evolve every N iterations (default: 2)

**Example:**
```bash
curl -X POST https://api.reels.hurated.com/api/fpo/run \
  -H "Content-Type: application/json" \
  -d '{
    "iterations": 7,
    "enableEvolution": true,
    "evolutionInterval": 2
  }'
```

### 2. Get Evolution Status

**Endpoint:** `GET /api/fpo/status`

**Response:**
```json
{
  "globalPrompt": "structured",
  "populationSize": 6,
  "maxGeneration": 1,
  "templates": [
    {
      "id": "structured",
      "name": "Structured Analysis",
      "template": "Analyze this video frame...",
      "weight": 0.023,
      "generation": 0,
      "parents": [],
      "performanceHistory": [...],
      "latestScore": 0.023
    },
    {
      "id": "evolved_gen1_abc",
      "name": "Evolved Gen 1",
      "template": "Describe in detail...",
      "weight": 0.041,
      "generation": 1,
      "parents": ["baseline", "technical"],
      "performanceHistory": [...],
      "latestScore": 0.041
    }
  ]
}
```

**Example:**
```bash
curl https://api.reels.hurated.com/api/fpo/status | jq .
```

---

## 🎯 Using the `evolve.sh` Script

### Installation

Already installed in `scripts/evolve.sh`. Make executable:
```bash
chmod +x scripts/evolve.sh
```

### Commands

#### 1. **Start Evolution**
```bash
# Basic (5 iterations on dev)
./scripts/evolve.sh start

# Production (5 iterations)
./scripts/evolve.sh start prod

# Custom iterations (7 rounds, evolve every 2)
./scripts/evolve.sh start -n 7 -i 2 prod

# Upload video first, then evolve
./scripts/evolve.sh start -v sample.mp4 prod

# Evolution every 3 iterations (for longer runs)
./scripts/evolve.sh start -n 9 -i 3 prod
```

**Output:**
```
=== Starting Prompt Evolution (prod) ===
Iterations: 5
Evolution Interval: every 2 iterations
Evolution Enabled: true

Starting evolution process...
This will take approximately 10 minutes

POST https://api.reels.hurated.com/api/fpo/run
{
  "iterations": 5,
  "enableEvolution": true,
  "evolutionInterval": 2
}

✓ Evolution completed!

Results:
  Iterations: 5
  Best prompt: evolved_gen2_xyz
  Evolved prompts: 2
  Max generation: 2

View detailed results:
  ./scripts/evolve.sh status prod
  ./scripts/show-prompts.sh prod
```

#### 2. **Check Status**
```bash
# Check current evolution state
./scripts/evolve.sh status prod

# Alias
./scripts/evolve.sh show prod
```

**Output:**
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
   Weight: 0.022986851884394508

2. Technical Details (technical)
   Weight: 0.009624297328417526

3. Evolved Gen 1 (evolved_gen1_mgn2rtrw)
   Weight: -0.035104389825456670
   Generation: 1
   Parents: technical, baseline

Data stored in: data/prompts.json
View at: https://wandb.ai/prompt-reels
```

#### 3. **View Detailed Prompts**
```bash
# Show all prompts with full text
./scripts/show-prompts.sh prod

# Show top 3
./scripts/show-prompts.sh -n 3 prod
```

### All Options

```bash
./scripts/evolve.sh [COMMAND] [OPTIONS] [ENVIRONMENT]

Commands:
  start                   Start prompt evolution
  status                  Get current evolution status
  show                    Show current prompts (alias for status)

Options:
  -n, --iterations NUM    Number of iterations (default: 5)
  -i, --interval NUM      Evolution interval (default: 2)
  --no-evolution          Disable evolution (testing only)
  -v, --video FILE        Upload video first, then evolve
  -h, --help              Show this help message

Environment:
  dev                     Local dev server (default)
  prod                    Production server
```

---

## 🔄 Evolution Process

### Timeline Example (7 iterations)

```
Iteration 1: Test 5 original prompts
             ↓
Iteration 2: Test + 🧬 Create Gen 1
             • Breed: structured × technical
             • Child: evolved_gen1_abc
             ↓
Iteration 3: Test 6 prompts (5 original + 1 evolved)
             ↓
Iteration 4: Test + 🧬 Create Gen 2
             • Breed: evolved_gen1_abc × structured
             • Child: evolved_gen2_xyz
             ↓
Iteration 5: Test 7 prompts
             ↓
Iteration 6: Test + 🧬 Create Gen 3
             • Breed: evolved_gen2_xyz × evolved_gen1_abc
             • Child: evolved_gen3_mno
             ↓
Iteration 7: Test 8 prompts

Final population: 8 prompts
  - 5 original (Gen 0)
  - 3 evolved (Gen 1, 2, 3)
```

### What Happens During Evolution?

1. **Selection**: Top 2 performing prompts selected as parents
2. **Crossover**: Azure GPT-4.1 analyzes both parents
3. **Breeding**: LLM combines best features intelligently
4. **Birth**: New child prompt created with unique ID
5. **Testing**: Child tested in next iteration alongside parents
6. **Survival**: Best prompts survive, worst removed if population > 10

---

## 📊 Tracking Results

### Local Files

**Prompts data:**
```bash
cat data/prompts.json | jq '.templates[] | select(.generation > 0)'
```

**Performance history:**
```bash
cat data/prompts.json | jq '.templates[] | 
  {id, weight, evaluations: (.performance | length)}'
```

### Weights & Biases

View full experiment tracking at:
**https://wandb.ai/prompt-reels**

Shows:
- Iteration-by-iteration scores
- Evolution events
- Population composition
- Generation progression
- Individual prompt performance

---

## 🎬 Complete Workflow

### Starting Fresh

```bash
# 1. Upload test video
curl -X POST -F "video=@sample.mp4" \
  https://api.reels.hurated.com/api/upload

# 2. Analyze it (creates frames)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"videoId":"<video-id>"}' \
  https://api.reels.hurated.com/api/analyze

# 3. Start evolution
./scripts/evolve.sh start -n 7 prod

# 4. Check status
./scripts/evolve.sh status prod

# 5. View evolved prompts
./scripts/show-prompts.sh prod
```

### Or Use Shortcut:

```bash
# Upload video and evolve in one command
./scripts/evolve.sh start -v sample.mp4 -n 7 prod
```

---

## 🧪 Testing Scenarios

### Scenario 1: Quick Test (3 iterations)
```bash
./scripts/evolve.sh start -n 3 prod
```
- Tests original prompts
- Creates 1 evolved prompt
- Fast (~6 minutes)

### Scenario 2: Standard Evolution (5 iterations)
```bash
./scripts/evolve.sh start -n 5 prod
```
- Creates 2 generations
- Balanced speed/results
- ~10 minutes

### Scenario 3: Deep Evolution (10 iterations)
```bash
./scripts/evolve.sh start -n 10 -i 2 prod
```
- Creates 5 generations
- Tests many evolved prompts
- ~20 minutes
- Best for seeing real improvement

---

## 📈 Success Metrics

### What to Look For:

**1. Evolved prompts outperforming originals:**
```
1. Evolved Gen 2 (weight: 0.045)  ← Better than originals!
2. Baseline (weight: 0.033)
3. Technical (weight: 0.012)
```

**2. Population growth:**
```
Population: 8 prompts (5 original + 3 evolved)
Max generation: 3
```

**3. Increasing weights over generations:**
```
Gen 0 best: 0.033
Gen 1 best: 0.041
Gen 2 best: 0.045  ← Improving!
```

---

## 🔍 Debugging

### Check if evolution is running:
```bash
ssh reels.hurated.com "docker compose -f prompt-reels/compose.yml logs -f"
```

Look for:
- `🧬 EVOLUTION PHASE`
- `🧬 Evolving new prompt from:`
- `✓ Created: Evolved Gen N`

### Check evolved prompts in file:
```bash
ssh reels.hurated.com "cat prompt-reels/data/prompts.json" | \
  jq '.templates[] | select(.generation > 0)'
```

### Common Issues:

**No evolved prompts appearing:**
- Check `enableEvolution: true` in request
- Verify iteration number ≥ evolutionInterval
- Check logs for errors

**All evolved prompts have negative weights:**
- Normal! Evolution is trial-and-error
- Keep running more iterations
- Best prompts will eventually emerge

---

## 🎓 Pro Tips

1. **Run longer sessions** (7-10 iterations) to see real evolution
2. **Check W&B dashboard** for visualizations
3. **Use multiple test videos** for better evaluation
4. **Monitor population diversity** - keep original prompts
5. **Evolution interval of 2-3** works best
6. **Patience!** Evolution takes time to show results

---

## 📚 Related Commands

```bash
# View all prompts with details
./scripts/show-prompts.sh prod

# Reset to original prompts
npm run reset-prompts

# View W&B logs locally
cat output/weave-logs/weave-*.jsonl | jq 'select(.type == "fpo_iteration")'

# Monitor server in real-time
ssh reels.hurated.com "docker compose -f prompt-reels/compose.yml logs -f"
```

---

## Summary

✅ **Evolved prompts stored in:** `data/prompts.json`  
✅ **Start evolution:** `./scripts/evolve.sh start prod`  
✅ **Check status:** `./scripts/evolve.sh status prod`  
✅ **View prompts:** `./scripts/show-prompts.sh prod`  
✅ **Track experiments:** https://wandb.ai/prompt-reels

The system is now fully self-improving! 🚀
