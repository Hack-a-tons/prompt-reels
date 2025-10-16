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
  
  // Don't log here - weave.js will log AI provider during initialization
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
 * Describe a scene based on multiple frames
 * @param {Array<string>} framePaths - Paths to frame images
 * @param {number} sceneId - Scene identifier
 * @param {number} start - Scene start time
 * @param {number} end - Scene end time
 * @param {string} languageInstruction - Optional language instruction
 * @param {number} retryCount - Internal retry counter (do not pass manually)
 */
const describeScene = async (framePaths, sceneId, start, end, languageInstruction = null, retryCount = 0) => {
  const MAX_RETRIES = 1; // Only try both providers once
  
  try {
    // Read all frame images
    const frameData = framePaths.map(path => {
      const buffer = fs.readFileSync(path);
      return buffer.toString('base64');
    });

    let prompt = `Analyze these ${frameData.length} frames from Scene ${sceneId} (${start.toFixed(1)}s - ${end.toFixed(1)}s) of a video. 
The frames show the beginning, middle, and end of this scene.

Provide a clear, concise title (1-2 sentences maximum) that captures what happens in this scene. Focus on:
- Main actions or events
- Key subjects or objects
- Scene setting or context

Do NOT start with phrases like "In this scene" or "This scene shows". Just describe what's happening directly, as a title would.`;

    // Add language instruction if provided
    if (languageInstruction) {
      prompt += `\n\n${languageInstruction}`;
    }

    if (currentProvider === 'azure') {
      if (!azureClient) {
        throw new Error('Azure OpenAI client not initialized');
      }
      
      const content = [
        { type: 'text', text: prompt }
      ];
      
      // Add all frames
      frameData.forEach(base64 => {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64}`,
          },
        });
      });
      
      const response = await azureClient.chat.completions.create({
        model: config.azureOpenAI.deploymentName,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: 300,
      });
      
      return response.choices[0].message.content;
    } else {
      // Use Gemini
      if (!geminiClient) {
        throw new Error('Gemini client not initialized');
      }
      
      const model = geminiClient.getGenerativeModel({ model: config.geminiModel });
      
      // Build content array with prompt and all images
      const content = [prompt];
      frameData.forEach(base64 => {
        content.push({
          inlineData: {
            data: base64,
            mimeType: 'image/jpeg',
          },
        });
      });
      
      const result = await model.generateContent(content);
      const response = await result.response;
      return response.text();
    }
  } catch (error) {
    console.error(`Error describing scene ${sceneId} with ${currentProvider}:`, error.message);
    
    // Check if we've exceeded retry limit
    if (retryCount >= MAX_RETRIES) {
      console.error(`Max retries (${MAX_RETRIES}) exceeded for scene ${sceneId}`);
      throw new Error(`Failed to describe scene after trying both providers: ${error.message}`);
    }
    
    // Try fallback provider
    const fallbackProvider = currentProvider === 'azure' ? 'gemini' : 'azure';
    const fallbackClient = fallbackProvider === 'azure' ? azureClient : geminiClient;
    
    if (fallbackClient) {
      console.log(`Switching to ${fallbackProvider} for scene description (retry ${retryCount + 1}/${MAX_RETRIES})`);
      const prevProvider = currentProvider;
      currentProvider = fallbackProvider;
      const result = await describeScene(framePaths, sceneId, start, end, languageInstruction, retryCount + 1);
      currentProvider = prevProvider; // Restore provider
      return result;
    }
    
    throw error;
  }
};

/**
 * Generate a concise title for a scene based on visual description and dialogue
 * @param {string} visualDescription - Scene visual description
 * @param {string} dialogue - Scene dialogue transcript (optional)
 * @param {string} language - Language for the title
 * @returns {Promise<string>} Concise one-line title
 */
const generateSceneTitle = async (visualDescription, dialogue = null, language = 'English') => {
  try {
    const dialoguePart = dialogue ? `\n\nDialogue:\n${dialogue}` : '';
    const languageInstruction = language.toLowerCase() !== 'english' 
      ? `Provide the title in ${language}.`
      : '';
    
    const prompt = `Create a short, descriptive title (maximum one line, 8-12 words) for this scene.

Visual: ${visualDescription}${dialoguePart}

${languageInstruction}

Requirements:
- ONE line only (no periods at end)
- Capture the main action or topic
- Be specific and descriptive
- Use active voice
- No generic phrases like "Scene shows" or "In this scene"

Return ONLY the title text, nothing else.`;

    if (currentProvider === 'azure') {
      if (!azureClient) {
        return 'Untitled Scene';
      }
      
      const response = await azureClient.chat.completions.create({
        model: config.azureOpenAI.deploymentName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.4,
      });
      
      return response.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    } else {
      if (!geminiClient) {
        return 'Untitled Scene';
      }
      
      const model = geminiClient.getGenerativeModel({ 
        model: config.geminiModel,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 50,
        }
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim().replace(/^["']|["']$/g, '');
    }
  } catch (error) {
    console.error(`Error generating scene title: ${error.message}`);
    return 'Untitled Scene';
  }
};

/**
 * Generate an overall video title based on all scenes
 * @param {Array} scenes - Array of scene objects with descriptions and transcripts
 * @param {string} language - Language for the title
 * @returns {Promise<string>} Concise one-line video title
 */
const generateVideoTitle = async (scenes, language = 'English') => {
  try {
    const summaries = scenes.map((s, i) => {
      const desc = s.description || '';
      const trans = s.transcript?.text || '';
      return `Scene ${i + 1}: ${desc} ${trans}`.substring(0, 200);
    }).join('\n');
    
    const languageInstruction = language.toLowerCase() !== 'english' 
      ? `Provide the title in ${language}.`
      : '';
    
    const prompt = `Create a short, descriptive title (maximum one line, 8-12 words) that summarizes this entire video.

${summaries}

${languageInstruction}

Requirements:
- ONE line only (no periods at end)
- Capture the main theme or topic
- Be specific and engaging
- Use active voice
- Professional and clear

Return ONLY the title text, nothing else.`;

    if (currentProvider === 'azure') {
      if (!azureClient) {
        return 'Untitled Video';
      }
      
      const response = await azureClient.chat.completions.create({
        model: config.azureOpenAI.deploymentName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.4,
      });
      
      return response.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    } else {
      if (!geminiClient) {
        return 'Untitled Video';
      }
      
      const model = geminiClient.getGenerativeModel({ 
        model: config.geminiModel,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 50,
        }
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim().replace(/^["']|["']$/g, '');
    }
  } catch (error) {
    console.error(`Error generating video title: ${error.message}`);
    return 'Untitled Video';
  }
};

/**
 * Format transcript text to make it more readable
 * Adds proper punctuation, capitalization, paragraph breaks, and emphasis
 * @param {string} text - Raw transcript text
 * @param {string} language - Language of the text (e.g., "Russian", "English")
 * @returns {Promise<string>} Formatted text with markdown
 */
const formatTranscript = async (text, language = 'English') => {
  if (!text || text.length < 10) {
    return text;
  }
  
  try {
    const languageInstruction = language.toLowerCase() !== 'english' 
      ? `The text is in ${language}. Keep all output in ${language}.`
      : '';
    
    const prompt = `Format this transcript dialogue to make it highly readable. Apply these improvements:

1. **Sentence Structure**: Split into proper sentences with correct punctuation
2. **Capitalization**: Capitalize sentence starts, names, and proper nouns
3. **Paragraph Breaks**: Add line breaks (\\n\\n) between distinct topics or speakers
4. **Emphasis**: Use *italic* for emotional emphasis or **bold** for speaker names/important terms
5. **Readability**: Keep natural flow, remove filler words if excessive

${languageInstruction}

Original transcript:
${text}

Return ONLY the formatted text with markdown. No explanations or metadata.`;

    if (currentProvider === 'azure') {
      if (!azureClient) {
        return text; // Fallback to original if Azure not available
      }
      
      const response = await azureClient.chat.completions.create({
        model: config.azureOpenAI.deploymentName,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more consistent formatting
      });
      
      return response.choices[0].message.content.trim();
    } else {
      // Use Gemini
      if (!geminiClient) {
        return text; // Fallback to original if Gemini not available
      }
      
      const model = geminiClient.getGenerativeModel({ 
        model: config.geminiModel,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        }
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    }
  } catch (error) {
    console.error(`Error formatting transcript: ${error.message}`);
    return text; // Return original text on error
  }
};

/**
 * Generate embeddings using hash-based similarity
 * (No real embeddings to keep it simple)
 */
const generateEmbedding = async (text) => {
  // Use simple hash-based representation
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  
  // Convert to array of pseudo-embeddings
  const embedding = [];
  for (let i = 0; i < 10; i++) {
    embedding.push((hash >> i) % 100 / 100);
  }
  
  return embedding;
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
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`✓  ${timestamp} AI Provider switched to: ${currentProvider}`);
};

// Initialize on module load
initClients();

module.exports = {
  describeImage,
  describeScene,
  generateSceneTitle,
  generateVideoTitle,
  formatTranscript,
  generateEmbedding,
  cosineSimilarity,
  getCurrentProvider,
  setProvider,
};
