/**
 * Article Workflow Management
 * Tracks article processing status through the pipeline:
 * queued → fetched → described → rated
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { log } = require('../utils/logger');

/**
 * Article status enum
 */
const ArticleStatus = {
  QUEUED: 'queued',       // Queued for fetching
  FETCHED: 'fetched',     // Article and video fetched
  DESCRIBED: 'described', // Scenes detected and described
  RATED: 'rated',         // Video-article match rated
  ERROR: 'error',         // Error in processing
};

/**
 * Update article status
 */
const updateArticleStatus = (articleId, status, metadata = {}) => {
  const articlesDir = path.join(config.outputDir, 'articles');
  const articlePath = path.join(articlesDir, `${articleId}.json`);
  
  if (!fs.existsSync(articlePath)) {
    throw new Error(`Article not found: ${articleId}`);
  }
  
  const articleData = JSON.parse(fs.readFileSync(articlePath, 'utf8'));
  
  articleData.workflow = {
    status,
    updatedAt: new Date().toISOString(),
    ...metadata,
  };
  
  // Add status history
  if (!articleData.statusHistory) {
    articleData.statusHistory = [];
  }
  articleData.statusHistory.push({
    status,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
  
  fs.writeFileSync(articlePath, JSON.stringify(articleData, null, 2));
  log.info(`Article ${articleId} status: ${status}`);
  
  return articleData;
};

/**
 * Get article status
 */
const getArticleStatus = (articleId) => {
  const articlesDir = path.join(config.outputDir, 'articles');
  const articlePath = path.join(articlesDir, `${articleId}.json`);
  
  if (!fs.existsSync(articlePath)) {
    return null;
  }
  
  const articleData = JSON.parse(fs.readFileSync(articlePath, 'utf8'));
  return articleData.workflow?.status || ArticleStatus.FETCHED;
};

/**
 * List all articles with their status
 */
const listArticles = () => {
  const articlesDir = path.join(config.outputDir, 'articles');
  
  if (!fs.existsSync(articlesDir)) {
    return [];
  }
  
  const files = fs.readdirSync(articlesDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a)); // Newest first
  
  return files.map(file => {
    const articlePath = path.join(articlesDir, file);
    const articleData = JSON.parse(fs.readFileSync(articlePath, 'utf8'));
    
    return {
      articleId: articleData.articleId,
      title: articleData.title,
      source: articleData.source.domain,
      status: articleData.workflow?.status || ArticleStatus.FETCHED,
      videoUrl: articleData.video.url,
      videoType: articleData.video.type,
      hasLocalVideo: !!articleData.video.localPath,
      fetchedAt: articleData.fetchedAt,
      updatedAt: articleData.workflow?.updatedAt || articleData.fetchedAt,
      sceneCount: articleData.workflow?.sceneCount || 0,
      matchScore: articleData.workflow?.matchScore || null,
    };
  });
};

/**
 * Get article details
 */
const getArticleDetails = (articleId) => {
  const articlesDir = path.join(config.outputDir, 'articles');
  const articlePath = path.join(articlesDir, `${articleId}.json`);
  
  if (!fs.existsSync(articlePath)) {
    return null;
  }
  
  const articleData = JSON.parse(fs.readFileSync(articlePath, 'utf8'));
  
  // Check for scene data
  let sceneData = null;
  const scenesPath = path.join(config.outputDir, `${articleId}_scenes.json`);
  if (fs.existsSync(scenesPath)) {
    sceneData = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
  }
  
  return {
    ...articleData,
    sceneData,
  };
};

/**
 * Link article to its video scenes
 */
const linkArticleToScenes = (articleId, videoId, sceneCount) => {
  updateArticleStatus(articleId, ArticleStatus.DESCRIBED, {
    videoId,
    sceneCount,
  });
};

/**
 * Add video-article match rating
 */
const rateArticleMatch = (articleId, matchScore, details = {}) => {
  updateArticleStatus(articleId, ArticleStatus.RATED, {
    matchScore,
    ratingDetails: details,
  });
};

module.exports = {
  ArticleStatus,
  updateArticleStatus,
  getArticleStatus,
  listArticles,
  getArticleDetails,
  linkArticleToScenes,
  rateArticleMatch,
};
