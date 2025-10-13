const axios = require('axios');
const { log } = require('../utils/logger');

/**
 * Parse RSS/Atom feed XML
 * @param {string} xml - RSS/Atom XML content
 * @returns {Array} Array of articles
 */
const parseRSSFeed = (xml) => {
  const articles = [];
  
  // Very basic XML parsing (regex-based)
  // For production, consider using xml2js or similar
  
  // Try RSS 2.0 format first
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1];
    const description = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1];
    const pubDate = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1];
    const content = (item.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i) || [])[1];
    
    if (title && link) {
      articles.push({
        title: cleanHTML(title),
        url: cleanHTML(link),
        content: cleanHTML(description || content || ''),
        raw_content: cleanHTML(content || description || ''),
        published_date: pubDate || null,
        score: 0.9, // RSS feeds are generally high quality
      });
    }
  }
  
  // If no RSS items, try Atom format
  if (articles.length === 0) {
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      
      const title = (entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
      const linkMatch = entry.match(/<link[^>]*href=["']([^"']+)["']/i);
      const link = linkMatch ? linkMatch[1] : null;
      const summary = (entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || [])[1];
      const content = (entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i) || [])[1];
      const published = (entry.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || [])[1];
      
      if (title && link) {
        articles.push({
          title: cleanHTML(title),
          url: link,
          content: cleanHTML(summary || content || ''),
          raw_content: cleanHTML(content || summary || ''),
          published_date: published || null,
          score: 0.9,
        });
      }
    }
  }
  
  return articles;
};

/**
 * Clean HTML tags and entities from text
 * @param {string} text - Text with HTML
 * @returns {string} Clean text
 */
const cleanHTML = (text) => {
  if (!text) return '';
  
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // Remove CDATA
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
};

/**
 * Major news sites RSS feeds
 * Focus on sites with video content
 */
const NEWS_RSS_FEEDS = [
  // US News
  'https://rss.cnn.com/rss/cnn_topstories.rss',
  'https://feeds.nbcnews.com/nbcnews/public/news',
  'https://feeds.abcnews.com/abcnews/topstories',
  'https://moxie.foxnews.com/google-publisher/latest.xml',
  'https://www.cbsnews.com/latest/rss/main',
  
  // Tech News (often has video)
  'https://www.theverge.com/rss/index.xml',
  'https://www.cnet.com/rss/news/',
  'https://techcrunch.com/feed/',
  
  // Business News
  'https://feeds.bloomberg.com/markets/news.rss',
  'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  
  // International
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.reuters.com/rssFeed/topNews',
];

/**
 * Fetch articles from RSS feeds (free, no API key needed)
 * @param {number} maxArticles - Maximum articles to fetch
 * @param {string[]} feeds - Array of RSS feed URLs (optional)
 * @returns {Promise<Array>} Array of articles
 */
const fetchFromRSSFeeds = async (maxArticles = 20, feeds = NEWS_RSS_FEEDS) => {
  log.info(`Fetching articles from ${feeds.length} RSS feeds...`);
  const articles = [];
  const errors = [];
  
  for (const feedUrl of feeds) {
    try {
      log.debug(`Fetching feed: ${feedUrl}`);
      const response = await axios.get(feedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PromptReels/1.0; +https://reels.hurated.com)',
        },
      });
      
      const feedArticles = parseRSSFeed(response.data);
      articles.push(...feedArticles);
      
      log.info(`✓ ${new URL(feedUrl).hostname}: ${feedArticles.length} articles`);
      
      // Stop if we have enough
      if (articles.length >= maxArticles) {
        break;
      }
    } catch (error) {
      const hostname = new URL(feedUrl).hostname;
      log.warn(`Failed to fetch ${hostname}: ${error.message}`);
      errors.push({ feed: hostname, error: error.message });
    }
  }
  
  log.info(`Fetched ${articles.length} articles from RSS feeds`);
  
  if (errors.length > 0 && errors.length === feeds.length) {
    log.error('All RSS feeds failed:');
    errors.forEach(e => log.error(`  ${e.feed}: ${e.error}`));
  }
  
  return articles.slice(0, maxArticles);
};

/**
 * Fetch single article by direct URL (manual input)
 * @param {string} url - Article URL
 * @returns {Promise<Object>} Article data
 */
const fetchArticleByURL = async (url) => {
  log.info(`Fetching article from URL: ${url}`);
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PromptReels/1.0; +https://reels.hurated.com)',
      },
    });
    
    const html = response.data;
    const domain = new URL(url).hostname;
    
    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? cleanHTML(titleMatch[1]) : domain;
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1] : '';
    
    // Extract OpenGraph data
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    
    return {
      title: ogTitleMatch ? ogTitleMatch[1] : title,
      url: url,
      content: ogDescMatch ? ogDescMatch[1] : description,
      raw_content: '', // Will be extracted by BrowserBase
      published_date: null,
      score: 0.8,
    };
  } catch (error) {
    log.error(`Failed to fetch article: ${error.message}`);
    throw error;
  }
};

module.exports = {
  fetchFromRSSFeeds,
  fetchArticleByURL,
  NEWS_RSS_FEEDS,
};
