# FPO Progress Output Example

When you run FPO, you'll now see real-time progress:

```
============================================================
🎯 FPO Iteration 1
============================================================

🔄 Starting evaluation: 15 total API requests
   Domains: 3, Prompts: 5

[1/15] (6.7%) Evaluating: baseline @ news
Rate limiting: waiting 25.3s before next request...
   ✓ Score: 0.8234, Latency: 2341ms

[2/15] (13.3%) Evaluating: structured @ news
Rate limiting: waiting 28.1s before next request...
   ✓ Score: 0.8567, Latency: 2198ms

[3/15] (20.0%) Evaluating: narrative @ news
Rate limiting: waiting 27.8s before next request...
   ✓ Score: 0.7891, Latency: 2456ms

[4/15] (26.7%) Evaluating: technical @ news
Rate limiting: waiting 29.2s before next request...
   ✓ Score: 0.8123, Latency: 2287ms

[5/15] (33.3%) Evaluating: comprehensive @ news
Rate limiting: waiting 28.5s before next request...
   ✓ Score: 0.8934, Latency: 2612ms

[6/15] (40.0%) Evaluating: baseline @ sports
Rate limiting: waiting 27.9s before next request...
   ✓ Score: 0.7654, Latency: 2345ms

... (continues for all 15 requests)

────────────────────────────────────────────────────────────
📊 Iteration 1 Complete
   Global prompt: comprehensive
   Prompt weights:
      baseline             weight: 0.7823
      structured           weight: 0.8234
      narrative            weight: 0.7456
      technical            weight: 0.8012
      comprehensive        weight: 0.8934
────────────────────────────────────────────────────────────
```

## What You'll See

- **Total requests**: Shows how many API calls will be made
- **Progress counter**: `[5/15] (33.3%)` - Current position and percentage
- **Rate limiting**: When waiting between requests
- **Real-time results**: Score and latency for each evaluation
- **Iteration summary**: Final weights and best prompt selected

## Timing

With **3 domains × 5 prompts = 15 requests** per iteration:
- Rate limit: ~30 seconds between requests
- **Total time per iteration**: ~7.5 minutes
- **3 iterations**: ~22-23 minutes

You'll see progress in real-time so you know it's working!
