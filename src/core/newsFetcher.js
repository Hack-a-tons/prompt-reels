const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { log } = require('../utils/logger');
const { ArticleStatus } = require('./articleWorkflow');

/**
 * Fetch latest news articles using Tavily API
 * @param {string} query - Search query (default: "latest news video")
 * @param {number} maxResults - Maximum number of results (default: 5)
 * @returns {Promise<Array>} Array of news articles
 */
const fetchNewsWithTavily = async (query = 'latest news video', maxResults = 5) => {
  if (!config.tavilyApiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  try {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: config.tavilyApiKey,
      query: `${query} video`,
      max_results: maxResults,
      search_depth: 'advanced',
      include_images: true,
      include_answer: true,
      include_raw_content: true,
      topic: 'news',
    });

    log.info(`Tavily API: Found ${response.data.results?.length || 0} results`);
    return response.data.results || [];
  } catch (error) {
    log.error(`Tavily API error: ${error.message}`);
    if (error.response) {
      log.error(`Tavily response: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

/**
 * Extract video URL from article page using BrowserBase
 * @param {string} articleUrl - URL of the article
 * @returns {Promise<Object>} Object with video URL and metadata
 */
const extractVideoWithBrowserBase = async (articleUrl) => {
  if (!config.browserbaseApiKey || !config.browserbaseProjectId) {
    throw new Error('BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID not configured');
  }

  let browser = null;
  let sessionId = null;
  
  try {
    // Create a browser session
    const sessionResponse = await axios.post(
      'https://www.browserbase.com/v1/sessions',
      {
        projectId: config.browserbaseProjectId,
      },
      {
        headers: {
          'X-BB-API-Key': config.browserbaseApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    sessionId = sessionResponse.data.id;
    const connectUrl = sessionResponse.data.connectUrl;
    log.debug(`BrowserBase session created: ${sessionId}`);

    // Navigate to the page and extract video elements
    // Using Playwright-compatible commands via BrowserBase
    const { chromium } = require('playwright-core');
    browser = await chromium.connectOverCDP(connectUrl);
    const context = browser.contexts()[0];
    const page = await context.newPage();

    await page.goto(articleUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Extract video sources
    const videoData = await page.evaluate(() => {
      const videos = [];
      
      // Check for video tags
      document.querySelectorAll('video').forEach(video => {
        // Try multiple sources, skip blob URLs
        let src = video.src || video.currentSrc;
        
        // If main src is blob, check source elements
        if (!src || src.startsWith('blob:')) {
          const sources = video.querySelectorAll('source');
          for (const source of sources) {
            const sourceSrc = source.src || source.getAttribute('src');
            if (sourceSrc && !sourceSrc.startsWith('blob:')) {
              src = sourceSrc;
              break;
            }
          }
        }
        
        // Also check data attributes which often contain real URLs
        if (!src || src.startsWith('blob:')) {
          const dataSrc = video.getAttribute('data-src') || 
                         video.getAttribute('data-video-src') ||
                         video.getAttribute('data-url');
          if (dataSrc && !dataSrc.startsWith('blob:')) {
            src = dataSrc;
          }
        }
        
        // Only add if we have a real URL (not blob)
        if (src && !src.startsWith('blob:')) {
          videos.push({
            type: 'video',
            url: src,
            poster: video.poster || null,
          });
        }
      });

      // Check for embedded videos (YouTube, Vimeo, etc.)
      document.querySelectorAll('iframe').forEach(iframe => {
        const src = iframe.src;
        if (src && (src.includes('youtube.com') || src.includes('vimeo.com') || src.includes('dailymotion.com'))) {
          videos.push({
            type: 'embed',
            url: src,
            platform: src.includes('youtube.com') ? 'youtube' :
                     src.includes('vimeo.com') ? 'vimeo' :
                     src.includes('dailymotion.com') ? 'dailymotion' : 'unknown',
          });
        }
      });

      return videos.length > 0 ? videos[0] : null;
    });

    return videoData;
  } catch (error) {
    log.error(`BrowserBase error: ${error.message}`);
    return null;
  } finally {
    // Always close browser and end session
    if (browser) {
      try {
        await browser.close();
        log.debug(`BrowserBase session closed: ${sessionId}`);
      } catch (closeError) {
        log.warn(`Failed to close browser: ${closeError.message}`);
      }
    }
  }
};

/**
 * Download video from URL
 * @param {string} videoUrl - URL of the video
 * @param {string} articleId - Unique article identifier
 * @returns {Promise<string>} Path to downloaded video
 */
const downloadVideo = async (videoUrl, articleId) => {
  const articlesDir = path.join(config.uploadDir, 'articles');
  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }

  const videoPath = path.join(articlesDir, `${articleId}.mp4`);

  try {
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
      timeout: 60000, // 60 seconds
    });

    const writer = fs.createWriteStream(videoPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(videoPath));
      writer.on('error', reject);
    });
  } catch (error) {
    log.error(`Video download error: ${error.message}`);
    throw error;
  }
};

/**
 * Fetch news article with video - complete workflow with exponential retry
 * @param {string} query - Search query
 * @param {number} initialMaxResults - Initial number of results to try (default: 3)
 * @returns {Promise<Object>} Article with video and metadata
 */
const fetchNewsArticle = async (query = 'latest news video', initialMaxResults = 3) => {
  log.info(`Fetching news articles for: "${query}"`);
  
  // Exponential backoff: try 3, 6, 12, 24, 48, 96 articles
  const retryLimits = [3, 6, 12, 24, 48, 96];
  let totalChecked = 0;
  
  for (const maxResults of retryLimits) {
    log.info(`Trying Tavily with ${maxResults} articles...`);
    
    // Step 1: Fetch articles with Tavily
    const articles = await fetchNewsWithTavily(query, maxResults);
    log.info(`Tavily returned ${articles.length} articles`);

    if (articles.length === 0) {
      log.warn('No articles found from Tavily API');
      continue;
    }

    // Step 2: Try to extract video from articles
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      totalChecked++;
      log.info(`Checking article ${totalChecked} (${i + 1}/${articles.length} in batch): ${article.title.substring(0, 50)}...`);
      log.debug(`URL: ${article.url}`);

      try {
        const videoData = await extractVideoWithBrowserBase(article.url);
        
        if (videoData && videoData.url) {
          log.info(`Found video: ${videoData.url.substring(0, 60)}...`);
          
          // Generate article ID
          const articleId = `article-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
          
          // Download video
          log.info('Downloading video...');
          let videoPath = null;
          
          if (videoData.type === 'video') {
            try {
              videoPath = await downloadVideo(videoData.url, articleId);
              log.info(`Video downloaded: ${videoPath}`);
            } catch (error) {
              log.warn(`Could not download video: ${error.message}`);
            }
          }

          // Prepare article data
          const articleData = {
            articleId,
            source: {
              url: article.url,
              domain: new URL(article.url).hostname,
            },
            video: {
              url: videoData.url,
              type: videoData.type,
              platform: videoData.platform || 'direct',
              localPath: videoPath,
              poster: videoData.poster || null,
            },
            title: article.title,
            description: article.content || '',
            text: article.raw_content || article.content || '',
            score: article.score || 0,
            published: article.published_date || null,
            fetchedAt: new Date().toISOString(),
            images: article.images || [],
            workflow: {
              status: ArticleStatus.FETCHED,
              updatedAt: new Date().toISOString(),
            },
            statusHistory: [{
              status: ArticleStatus.FETCHED,
              timestamp: new Date().toISOString(),
            }],
          };

          // Save article metadata
          const articlesDir = path.join(config.outputDir, 'articles');
          if (!fs.existsSync(articlesDir)) {
            fs.mkdirSync(articlesDir, { recursive: true });
          }
          
          const metadataPath = path.join(articlesDir, `${articleId}.json`);
          fs.writeFileSync(metadataPath, JSON.stringify(articleData, null, 2));
          log.info(`Metadata saved: ${metadataPath}`);
          log.info(`✓ Success! Found video after checking ${totalChecked} articles`);

          return articleData;
        } else {
          log.warn('No video found in article');
        }
      } catch (error) {
        log.error(`Error processing article: ${error.message}`);
      }
    }
    
    // If we didn't find a video in this batch, try next batch size
    log.warn(`No videos found in ${articles.length} articles, trying larger batch...`);
  }

  throw new Error(`No articles with downloadable videos found after checking ${totalChecked} articles`);
};

module.exports = {
  fetchNewsWithTavily,
  extractVideoWithBrowserBase,
  downloadVideo,
  fetchNewsArticle,
};
