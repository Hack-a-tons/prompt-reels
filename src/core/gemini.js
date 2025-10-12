const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AzureOpenAI } = require('openai');
const config = require('../config');
const fs = require('fs');

let geminiClient = null;
let azureClient = null;
let currentProvider = config.aiProvider; // Track current provider

/**
 * Initialize AI clients
 */
const initClients = () => {
  if (config.googleApiKey) {
    geminiClient = new GoogleGenerativeAI(config.googleApiKey);
  }
  
  if (config.azureOpenAI.apiKey) {
    azureClient = new AzureOpenAI({
      apiKey: config.azureOpenAI.apiKey,
      endpoint: config.azureOpenAI.endpoint,
      apiVersion: config.azureOpenAI.apiVersion,
    });
  }
  
  console.log(`AI Provider: ${currentProvider}`);
};

/**
 * Describe an image using selected AI provider
 */
const describeImage = async (imagePath, prompt) => {
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');
  
  try {
    if (currentProvider === 'azure') {
      if (!azureClient) {
        throw new Error('Azure OpenAI client not initialized');
      }
      
      const response = await azureClient.chat.completions.create({
        model: config.azureOpenAI.deploymentName,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });
      
      return response.choices[0].message.content;
    } else {
      // Use Gemini
      if (!geminiClient) {
        throw new Error('Gemini client not initialized');
      }
      
      const model = geminiClient.getGenerativeModel({ model: config.geminiModel });
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg',
          },
        },
      ]);
      
      const response = await result.response;
      return response.text();
    }
  } catch (error) {
    console.error(`Error with ${currentProvider}:`, error.message);
    
    // Try fallback provider
    const fallbackProvider = currentProvider === 'azure' ? 'gemini' : 'azure';
    const fallbackClient = fallbackProvider === 'azure' ? azureClient : geminiClient;
    
    if (fallbackClient) {
      console.log(`Switching to ${fallbackProvider}`);
      currentProvider = fallbackProvider;
      return describeImage(imagePath, prompt);
    }
    
    throw error;
  }
};

/**
 * Generate embeddings using hash-based similarity
 * (No real embeddings to keep it simple)
 */
const generateEmbedding = async (text) => {
  // Use simple hash-based representation
  return Array.from({length: 1536}, (_, i) => {
    const hash = text.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), i);
    return (hash % 1000) / 1000;
  });
};

/**
 * Calculate cosine similarity between two embeddings
 */
const cosineSimilarity = (a, b) => {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Get current AI provider
 */
const getCurrentProvider = () => currentProvider;

/**
 * Set AI provider
 */
const setProvider = (provider) => {
  if (provider !== 'azure' && provider !== 'gemini') {
    throw new Error('Provider must be "azure" or "gemini"');
  }
  currentProvider = provider;
  console.log(`AI Provider: ${currentProvider}`);
};

// Initialize on module load
initClients();

module.exports = {
  describeImage,
  generateEmbedding,
  cosineSimilarity,
  getCurrentProvider,
  setProvider,
};
