const fs = require('fs');
const path = require('path');
const config = require('../config');
const { describeImage, generateEmbedding, cosineSimilarity } = require('./gemini');
const { logPromptEvaluation, logFPOIteration } = require('./weave');
const { evolvePopulation } = require('./promptEvolution');

/**
 * Load prompt templates from file
 */
const loadPrompts = () => {
  const promptsPath = path.join(config.dataDir, 'prompts.json');
  if (!fs.existsSync(promptsPath)) {
    throw new Error('Prompts file not found');
  }
  return JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
};

/**
 * Save prompt templates to file
 */
const savePrompts = (prompts) => {
  const promptsPath = path.join(config.dataDir, 'prompts.json');
  fs.writeFileSync(promptsPath, JSON.stringify(prompts, null, 2));
};

/**
 * Evaluate a single prompt on an image
 */
const evaluatePrompt = async (promptTemplate, imagePath, referenceText = null) => {
  try {
    const startTime = Date.now();
    
    // Generate description using the prompt
    const description = await describeImage(imagePath, promptTemplate);
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    let score = 0.5; // Default score if no reference
    
    // If reference text provided, calculate similarity
    if (referenceText) {
      const descEmbedding = await generateEmbedding(description);
      const refEmbedding = await generateEmbedding(referenceText);
      score = cosineSimilarity(descEmbedding, refEmbedding);
    }
    
    return {
      description,
      score,
      latency,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error evaluating prompt:', error);
    return {
      description: '',
      score: 0,
      latency: 0,
      error: error.message,
    };
  }
};

/**
 * Simulate federated prompt evaluation
 * Each domain evaluates all prompts locally
 */
const federatedEvaluation = async (prompts, testData) => {
  const results = [];
  
  // Calculate total requests for progress tracking
  const totalRequests = prompts.domains.length * prompts.templates.length;
  let completedRequests = 0;
  
  console.log(`\n🔄 Starting evaluation: ${totalRequests} total API requests`);
  console.log(`   Domains: ${prompts.domains.length}, Prompts: ${prompts.templates.length}\n`);
  
  for (const domain of prompts.domains) {
    const domainResults = {
      domain,
      promptScores: {},
    };
    
    // Evaluate each prompt template
    for (const template of prompts.templates) {
      const scores = [];
      
      // Progress indicator
      completedRequests++;
      const progress = ((completedRequests / totalRequests) * 100).toFixed(1);
      console.log(`\n[${completedRequests}/${totalRequests}] (${progress}%) Evaluating: ${template.id} @ ${domain}`);
      
      // Evaluate on test images (simulate)
      // In real implementation, would use domain-specific test data
      const testImage = testData[domain] || testData.default;
      
      if (testImage) {
        const result = await evaluatePrompt(
          template.template,
          testImage.path,
          testImage.reference
        );
        
        scores.push(result.score);
        console.log(`   ✓ Score: ${result.score.toFixed(4)}, Latency: ${result.latency}ms`);
        
        // Log to Weave
        await logPromptEvaluation({
          domain,
          promptId: template.id,
          score: result.score,
          latency: result.latency,
          description: result.description,
        });
      } else {
        console.log(`   ⊘ No test data available`);
      }
      
      // Calculate average score
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
      
      domainResults.promptScores[template.id] = avgScore;
    }
    
    results.push(domainResults);
  }
  
  return results;
};

/**
 * Aggregate results from federated clients
 * Update prompt weights based on performance
 */
const aggregateResults = (prompts, federatedResults) => {
  const globalScores = {};
  
  // Initialize scores
  prompts.templates.forEach(t => {
    globalScores[t.id] = [];
  });
  
  // Collect scores from all domains
  federatedResults.forEach(domainResult => {
    Object.entries(domainResult.promptScores).forEach(([promptId, score]) => {
      globalScores[promptId].push(score);
    });
  });
  
  // Update weights based on average performance
  prompts.templates = prompts.templates.map(template => {
    const scores = globalScores[template.id];
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0.5;
    
    // Update performance history
    if (!template.performance) {
      template.performance = [];
    }
    template.performance.push({
      score: avgScore,
      timestamp: new Date().toISOString(),
    });
    
    // Update weight (simple approach: weight = score)
    template.weight = avgScore;
    
    return template;
  });
  
  // Select best performing prompt as global
  const bestPrompt = prompts.templates.reduce((best, current) => {
    return current.weight > best.weight ? current : best;
  });
  
  prompts.global_prompt = bestPrompt.id;
  
  return prompts;
};

/**
 * Run one iteration of Federated Prompt Optimization
 */
const runFPOIteration = async (iterationNumber, testData, options = {}) => {
  const { enableEvolution = true, evolutionInterval = 2 } = options;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 FPO Iteration ${iterationNumber}`);
  console.log(`${'='.repeat(60)}`);
  
  // Load current prompts
  let prompts = loadPrompts();
  
  // Run federated evaluation
  const federatedResults = await federatedEvaluation(prompts, testData);
  
  // Aggregate and update prompts
  prompts = aggregateResults(prompts, federatedResults);
  
  // Evolve prompts (genetic crossover) after gathering performance data
  let evolutionResult = null;
  if (enableEvolution && iterationNumber % evolutionInterval === 0 && iterationNumber > 1) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧬 EVOLUTION PHASE - Generation ${Math.floor(iterationNumber / evolutionInterval)}`);
    console.log(`${'='.repeat(60)}`);
    
    evolutionResult = await evolvePopulation(prompts, {
      maxPopulation: 10,
      enableCrossover: true,
      enableMutation: false, // Start with just crossover
    });
    
    console.log(`\n   ✓ Evolved ${evolutionResult.evolved.length} new prompt(s)`);
    console.log(`   ✓ Population size: ${evolutionResult.populationSize}`);
    console.log(`   ✓ Current generation: ${evolutionResult.generation}`);
    console.log(`${'='.repeat(60)}\n`);
  }
  
  // Save updated prompts
  savePrompts(prompts);
  
  // Summary
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 Iteration ${iterationNumber} Complete`);
  console.log(`   Global prompt: ${prompts.global_prompt}`);
  console.log(`   Population size: ${prompts.templates.length}`);
  console.log(`   Prompt weights:`);
  prompts.templates
    .sort((a, b) => b.weight - a.weight)
    .forEach(t => {
      const gen = t.generation ? ` [Gen ${t.generation}]` : '';
      console.log(`      ${t.id.padEnd(25)} weight: ${t.weight.toFixed(4)}${gen}`);
    });
  console.log(`${'─'.repeat(60)}\n`);
  
  // Log iteration to Weave
  await logFPOIteration({
    iteration: iterationNumber,
    globalPrompt: prompts.global_prompt,
    populationSize: prompts.templates.length,
    evolved: evolutionResult ? evolutionResult.evolved.length : 0,
    generation: evolutionResult ? evolutionResult.generation : 0,
    prompts: prompts.templates.map(t => ({
      id: t.id,
      weight: t.weight,
      generation: t.generation || 0,
      avgScore: t.performance[t.performance.length - 1]?.score,
    })),
  });
  
  console.log(`Best prompt: ${prompts.global_prompt}`);
  
  return {
    iteration: iterationNumber,
    globalPrompt: prompts.global_prompt,
    results: federatedResults,
    evolution: evolutionResult,
  };
};

module.exports = {
  loadPrompts,
  savePrompts,
  evaluatePrompt,
  federatedEvaluation,
  aggregateResults,
  runFPOIteration,
};
