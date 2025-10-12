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
    log.error(`  Query: "${query}"`);
    log.error(`  Max results: ${maxResults}`);
    log.error(`  Error type: ${error.name}`);
    
    if (error.response) {
      log.error(`  HTTP Status: ${error.response.status}`);
      log.error(`  Response: ${JSON.stringify(error.response.data)}`);
    }
    
    if (error.code) {
      log.error(`  Error code: ${error.code}`);
    }
    
    // Provide helpful hints
    if (error.response?.status === 401) {
      log.error(`  Hint: Check TAVILY_API_KEY in .env`);
    } else if (error.response?.status === 429) {
      log.error(`  Hint: Rate limit exceeded - wait before retrying`);
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      log.error(`  Hint: Network connectivity issue`);
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

    // Use 'load' instead of 'networkidle' - more reliable
    // Increase timeout to 60s for slower sites
    try {
      await page.goto(articleUrl, { waitUntil: 'load', timeout: 60000 });
    } catch (gotoError) {
      // If goto times out, try to continue anyway - page might be partially loaded
      log.warn(`Page load timeout/error (continuing anyway): ${gotoError.message}`);
    }

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(2000);
    
    // Scroll down to trigger lazy-loaded videos
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);
    
    // Scroll back up
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);

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
        
        // Check more data attributes which often contain real URLs
        if (!src || src.startsWith('blob:')) {
          const dataSrc = video.getAttribute('data-src') || 
                         video.getAttribute('data-video-src') ||
                         video.getAttribute('data-url') ||
                         video.getAttribute('data-video-url') ||
                         video.getAttribute('data-lazy-src');
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
        const src = iframe.src || iframe.getAttribute('data-src');
        if (src && (src.includes('youtube.com') || src.includes('youtu.be') || 
                   src.includes('vimeo.com') || src.includes('dailymotion.com'))) {
          videos.push({
            type: 'embed',
            url: src,
            platform: (src.includes('youtube.com') || src.includes('youtu.be')) ? 'youtube' :
                     src.includes('vimeo.com') ? 'vimeo' :
                     src.includes('dailymotion.com') ? 'dailymotion' : 'unknown',
          });
        }
      });
      
      // Check for JSON-LD structured data (often has video URLs)
      document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          const findVideoUrl = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.contentUrl && typeof obj.contentUrl === 'string') return obj.contentUrl;
            if (obj.videoUrl && typeof obj.videoUrl === 'string') return obj.videoUrl;
            if (obj.embedUrl && typeof obj.embedUrl === 'string') return obj.embedUrl;
            for (const key in obj) {
              const result = findVideoUrl(obj[key]);
              if (result) return result;
            }
            return null;
          };
          const videoUrl = findVideoUrl(data);
          if (videoUrl && !videoUrl.startsWith('blob:')) {
            videos.push({
              type: 'video',
              url: videoUrl,
              poster: null,
            });
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      });
      
      // Check meta tags for video URLs
      document.querySelectorAll('meta[property*="video"], meta[name*="video"]').forEach(meta => {
        const content = meta.getAttribute('content');
        if (content && !content.startsWith('blob:') && (content.startsWith('http') || content.startsWith('//'))) {
          videos.push({
            type: 'video',
            url: content,
            poster: null,
          });
        }
      });

      return videos.length > 0 ? videos[0] : null;
    });

    return videoData;
  } catch (error) {
    log.error(`BrowserBase error: ${error.message}`);
    log.error(`  Article URL: ${articleUrl}`);
    log.error(`  Session ID: ${sessionId || 'not created'}`);
    log.error(`  Error type: ${error.name}`);
    
    // Log stack trace for debugging
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 5); // First 5 lines
      stackLines.forEach(line => log.error(`  ${line.trim()}`));
    }
    
    // If it's an axios error with response data, log it
    if (error.response) {
      log.error(`  HTTP Status: ${error.response.status}`);
      if (error.response.data) {
        log.error(`  Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
    
    // If it's a Playwright error, might have additional context
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      log.error(`  Timeout occurred - page may be slow or hanging`);
    }
    if (error.message.includes('429') || error.response?.status === 429) {
      log.error(`  Rate limit hit - too many requests to BrowserBase`);
    }
    
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
    log.error(`  Video URL: ${videoUrl.substring(0, 100)}${videoUrl.length > 100 ? '...' : ''}`);
    log.error(`  Article ID: ${articleId}`);
    log.error(`  Target path: ${videoPath}`);
    log.error(`  Error type: ${error.name}`);
    
    if (error.response) {
      log.error(`  HTTP Status: ${error.response.status}`);
      log.error(`  Content-Type: ${error.response.headers?.['content-type'] || 'unknown'}`);
    }
    
    if (error.code) {
      log.error(`  Error code: ${error.code}`);
    }
    
    // Provide helpful hints
    if (error.code === 'ENOTFOUND') {
      log.error(`  Hint: Video URL hostname not found - may be invalid or deleted`);
    } else if (error.code === 'ECONNREFUSED') {
      log.error(`  Hint: Connection refused - video server may be down`);
    } else if (error.response?.status === 403) {
      log.error(`  Hint: Access forbidden - video may require authentication`);
    } else if (error.response?.status === 404) {
      log.error(`  Hint: Video not found - may have been moved or deleted`);
    } else if (error.message.includes('timeout')) {
      log.error(`  Hint: Download timed out - video file may be too large`);
    }
    
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
  
  // Load existing articles to avoid duplicates
  const { listArticles } = require('./articleWorkflow');
  const existingArticles = listArticles();
  const existingUrls = new Set(existingArticles.map(a => a.source?.url).filter(Boolean));
  log.info(`Found ${existingUrls.size} existing articles in database`);
  
  // Exponential backoff: try 3, 6, 12, 24, 48, 96 articles
  const retryLimits = [3, 6, 12, 24, 48, 96];
  let totalChecked = 0;
  const checkedUrls = new Set(); // Track URLs we've already checked
  
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
    let newArticlesInBatch = 0;
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      // Skip if article already exists in database
      if (existingUrls.has(article.url)) {
        log.debug(`Skipping existing article: ${article.url}`);
        continue;
      }
      
      // Skip if we've already checked this URL in this session
      if (checkedUrls.has(article.url)) {
        log.debug(`Skipping already checked: ${article.url}`);
        continue;
      }
      
      checkedUrls.add(article.url);
      totalChecked++;
      newArticlesInBatch++;
      log.info(`Checking article ${totalChecked} (${newArticlesInBatch} new in batch): ${article.title.substring(0, 50)}...`);
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
          log.debug(`  Checked video tags, iframes, JSON-LD, and meta tags`);
        }
      } catch (error) {
        log.error(`Error processing article: ${error.message}`);
        log.error(`  Article: ${article.title.substring(0, 60)}...`);
        log.error(`  URL: ${article.url}`);
        log.error(`  Error type: ${error.name}`);
        
        // Show stack trace for unexpected errors
        if (error.stack && !error.message.includes('BrowserBase')) {
          const stackLines = error.stack.split('\n').slice(0, 3);
          stackLines.forEach(line => log.error(`  ${line.trim()}`));
        }
      }
    }
    
    // If we didn't find a video in this batch, try next batch size
    const skipped = articles.length - newArticlesInBatch;
    if (skipped > 0) {
      log.info(`Skipped ${skipped} duplicate articles from previous batches`);
    }
    log.warn(`No videos found in ${newArticlesInBatch} new articles, trying larger batch...`);
  }

  throw new Error(`No articles with downloadable videos found after checking ${totalChecked} unique articles`);
};

module.exports = {
  fetchNewsWithTavily,
  extractVideoWithBrowserBase,
  downloadVideo,
  fetchNewsArticle,
};
