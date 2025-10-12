const { describeImage } = require('./gemini');
const config = require('../config');

/**
 * Perform genetic crossover between two prompts
 * Uses LLM to intelligently combine the best aspects of both
 */
const crossoverPrompts = async (parent1, parent2) => {
  console.log(`\n🧬 Evolving new prompt from:`);
  console.log(`   Parent 1: ${parent1.name} (weight: ${parent1.weight.toFixed(4)})`);
  console.log(`   Parent 2: ${parent2.name} (weight: ${parent2.weight.toFixed(4)})`);

  // Use Azure GPT to create a hybrid prompt
  const evolutionPrompt = `You are a prompt engineer optimizing video frame description prompts.

Given these two high-performing prompts:

PROMPT 1 (weight: ${parent1.weight.toFixed(4)}):
"${parent1.template}"

PROMPT 2 (weight: ${parent2.weight.toFixed(4)}):
"${parent2.template}"

Create a NEW prompt that combines the best aspects of both. The new prompt should:
1. Merge effective instruction patterns from both parents
2. Keep the most successful elements from each
3. Be concise and clear
4. Work well for describing video frames across different content types (news, sports, social media)

Return ONLY the new prompt text, nothing else.`;

  try {
    // Use the AI to generate the hybrid prompt
    // We'll use a simple text prompt here since we don't need image analysis
    const { AzureOpenAI } = require('openai');
    
    if (!config.azureOpenAI.apiKey) {
      throw new Error('Azure OpenAI required for prompt evolution');
    }

    const azureClient = new AzureOpenAI({
      apiKey: config.azureOpenAI.apiKey,
      endpoint: config.azureOpenAI.endpoint,
      apiVersion: config.azureOpenAI.apiVersion,
    });

    const response = await azureClient.chat.completions.create({
      model: config.azureOpenAI.deploymentName,
      messages: [
        {
          role: 'system',
          content: 'You are a prompt engineering expert. Create hybrid prompts by combining the best elements of given examples.',
        },
        {
          role: 'user',
          content: evolutionPrompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7, // Some creativity, but not too wild
    });

    const newPromptText = response.choices[0].message.content.trim();
    
    // Remove quotes if the LLM wrapped the response
    const cleanPrompt = newPromptText.replace(/^["']|["']$/g, '');

    // Generate a unique ID for the new prompt
    const generation = Math.max(
      parent1.generation || 0,
      parent2.generation || 0
    ) + 1;
    
    const promptId = `evolved_gen${generation}_${Date.now().toString(36)}`;

    const childPrompt = {
      id: promptId,
      name: `Evolved Gen ${generation}`,
      template: cleanPrompt,
      weight: 0, // Start with neutral weight
      performance: [],
      generation: generation,
      parents: [parent1.id, parent2.id],
      created: new Date().toISOString(),
    };

    console.log(`   ✓ Created: ${childPrompt.name}`);
    console.log(`   Prompt: "${cleanPrompt}"`);

    return childPrompt;
  } catch (error) {
    console.error('Error during crossover:', error.message);
    return null;
  }
};

/**
 * Perform prompt mutation - slight variations of a winning prompt
 */
const mutatePrompt = async (prompt) => {
  console.log(`\n🔬 Mutating prompt: ${prompt.name}`);

  const mutationPrompt = `You are a prompt engineer creating variations of successful prompts.

Given this high-performing prompt (weight: ${prompt.weight.toFixed(4)}):
"${prompt.template}"

Create a SLIGHTLY IMPROVED version by:
1. Adding one useful detail or instruction
2. OR making it more specific
3. OR adjusting the phrasing for clarity
4. Keep the core structure that makes it work

Return ONLY the new prompt text, nothing else.`;

  try {
    const { AzureOpenAI } = require('openai');
    
    if (!config.azureOpenAI.apiKey) {
      throw new Error('Azure OpenAI required for prompt mutation');
    }

    const azureClient = new AzureOpenAI({
      apiKey: config.azureOpenAI.apiKey,
      endpoint: config.azureOpenAI.endpoint,
      apiVersion: config.azureOpenAI.apiVersion,
    });

    const response = await azureClient.chat.completions.create({
      model: config.azureOpenAI.deploymentName,
      messages: [
        {
          role: 'system',
          content: 'You are a prompt engineering expert. Create improved variations of successful prompts.',
        },
        {
          role: 'user',
          content: mutationPrompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.5, // Less creative than crossover
    });

    const newPromptText = response.choices[0].message.content.trim();
    const cleanPrompt = newPromptText.replace(/^["']|["']$/g, '');

    const generation = (prompt.generation || 0) + 1;
    const promptId = `mutated_gen${generation}_${Date.now().toString(36)}`;

    const mutatedPrompt = {
      id: promptId,
      name: `Mutated Gen ${generation}`,
      template: cleanPrompt,
      weight: 0,
      performance: [],
      generation: generation,
      parents: [prompt.id],
      mutationType: 'variation',
      created: new Date().toISOString(),
    };

    console.log(`   ✓ Created: ${mutatedPrompt.name}`);
    console.log(`   Prompt: "${cleanPrompt}"`);

    return mutatedPrompt;
  } catch (error) {
    console.error('Error during mutation:', error.message);
    return null;
  }
};

/**
 * Evolve the prompt population
 * - Crossover top 2 prompts
 * - Optionally mutate the best prompt
 * - Remove worst performers to keep population size manageable
 */
const evolvePopulation = async (prompts, options = {}) => {
  const {
    maxPopulation = 10,  // Keep population size manageable
    enableMutation = false,
    enableCrossover = true,
  } = options;

  // Sort by weight (best first)
  const sorted = [...prompts.templates].sort((a, b) => b.weight - a.weight);

  const evolved = [];

  // Genetic crossover: combine top 2
  if (enableCrossover && sorted.length >= 2) {
    const parent1 = sorted[0];
    const parent2 = sorted[1];
    
    const child = await crossoverPrompts(parent1, parent2);
    if (child) {
      evolved.push(child);
    }
  }

  // Optional: Mutate the best prompt
  if (enableMutation && sorted.length >= 1) {
    const mutated = await mutatePrompt(sorted[0]);
    if (mutated) {
      evolved.push(mutated);
    }
  }

  // Add evolved prompts to population
  const newPopulation = [...prompts.templates, ...evolved];

  // If population too large, remove worst performers
  // But keep original 5 baseline prompts
  if (newPopulation.length > maxPopulation) {
    const originalIds = ['baseline', 'structured', 'narrative', 'technical', 'comprehensive'];
    
    // Separate originals and evolved
    const originals = newPopulation.filter(p => originalIds.includes(p.id));
    const evolvedOnly = newPopulation.filter(p => !originalIds.includes(p.id));
    
    // Sort evolved by weight and keep best ones
    evolvedOnly.sort((a, b) => b.weight - a.weight);
    const keepEvolved = evolvedOnly.slice(0, maxPopulation - originals.length);
    
    prompts.templates = [...originals, ...keepEvolved];
  } else {
    prompts.templates = newPopulation;
  }

  return {
    evolved,
    populationSize: prompts.templates.length,
    generation: Math.max(...prompts.templates.map(p => p.generation || 0)),
  };
};

module.exports = {
  crossoverPrompts,
  mutatePrompt,
  evolvePopulation,
};
