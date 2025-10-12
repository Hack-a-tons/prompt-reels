/**
 * FPO Queue Processor
 * Handles background processing of FPO (Federated Prompt Optimization) jobs
 */

const { getArticleDetails, listArticles } = require('../core/articleWorkflow');
const { runFPOIteration } = require('../core/fpo');
const { setFlag, clearFlag } = require('../utils/flags');

/**
 * Process a single FPO job from the queue
 * @param {object} job - Job details from queue
 * @returns {object} - Processing result
 */
async function processFPOJob(job) {
  const { id, iterations = 3, enableEvolution = true, evolutionInterval = 2 } = job;
  
  console.log(`\n🧠 Starting FPO job: ${id}`);
  console.log(`   Iterations: ${iterations}`);
  console.log(`   Evolution: ${enableEvolution ? 'enabled' : 'disabled'}`);
  
  // Set flag to indicate FPO is running
  setFlag('fpo-running', {
    jobId: id,
    iterations,
    startedAt: new Date().toISOString(),
  });
  
  try {
    // Find described articles for testing
    const articles = listArticles();
    const describedArticles = articles.filter(a => a.status === 'described' || a.status === 'rated');
    
    if (describedArticles.length === 0) {
      throw new Error('No described articles found');
    }
    
    console.log(`   Found ${describedArticles.length} described articles for testing`);
    
    const results = [];
    
    // Run iterations with RANDOM article selection for better diversity
    for (let i = 1; i <= iterations; i++) {
      const testData = {};
      
      try {
        // Select a random article for this iteration (improves diversity!)
        const randomArticle = describedArticles[Math.floor(Math.random() * describedArticles.length)];
        const articleDetails = getArticleDetails(randomArticle.articleId);
        
        if (articleDetails && articleDetails.sceneData && articleDetails.sceneData.scenes.length > 0) {
          // Select a random scene from the article (more diversity!)
          const randomSceneIndex = Math.floor(Math.random() * articleDetails.sceneData.scenes.length);
          const randomScene = articleDetails.sceneData.scenes[randomSceneIndex];
          
          // Select a random frame from the scene
          const randomFrameIndex = Math.floor(Math.random() * randomScene.frames.length);
          const randomFrame = randomScene.frames[randomFrameIndex];
          
          const articleText = articleDetails.text || articleDetails.description || articleDetails.title;
          
          const domains = ['news', 'sports', 'reels'];
          for (const domain of domains) {
            testData[domain] = {
              path: randomFrame.path,
              reference: articleText.substring(0, 500),
            };
          }
          
          testData.default = testData.news;
          
          console.log(`   Iteration ${i}/${iterations}: article ${randomArticle.articleId}, scene ${randomSceneIndex}, frame ${randomFrameIndex}`);
        } else {
          console.log(`   ⚠ Iteration ${i}/${iterations}: No valid frames in article ${randomArticle.articleId}`);
        }
      } catch (e) {
        console.error(`   Error preparing test data for iteration ${i}:`, e.message);
      }
      
      const result = await runFPOIteration(i, testData, {
        enableEvolution,
        evolutionInterval,
      });
      results.push(result);
    }
    
    const lastResult = results[results.length - 1];
    
    // Clear flag
    clearFlag('fpo-running');
    
    console.log(`✓ FPO job ${id} completed: ${results.length} iterations`);
    
    return {
      success: true,
      iterations: results.length,
      results,
      finalPrompt: lastResult.globalPrompt,
      evolved: lastResult.evolution ? lastResult.evolution.evolved.length : 0,
      generation: lastResult.evolution ? lastResult.evolution.generation : 0,
    };
  } catch (error) {
    // Clear flag on error
    clearFlag('fpo-running');
    
    console.error(`✗ FPO job ${id} failed:`, error.message);
    throw error;
  }
}

module.exports = {
  processFPOJob,
};
