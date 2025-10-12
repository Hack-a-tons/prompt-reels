const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Generate a thumbnail for a video
 * Creates a small, optimized preview from the full video
 * 
 * @param {string} articleId - Article ID (e.g., "article-123")
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function generateThumbnail(articleId) {
  return new Promise((resolve, reject) => {
    const videoPath = path.join(config.uploadDir, 'articles', `${articleId}.mp4`);
    const thumbnailsDir = path.join(config.uploadDir, 'thumbnails');
    const thumbnailPath = path.join(thumbnailsDir, `${articleId}.mp4`);
    
    // Check if video exists
    if (!fs.existsSync(videoPath)) {
      console.log(`⚠️  Video not found for thumbnail generation: ${articleId}`);
      return resolve(false);
    }
    
    // Check if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
      console.log(`⏭️  Thumbnail already exists: ${articleId}`);
      return resolve(true);
    }
    
    // Create thumbnails directory if it doesn't exist
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }
    
    console.log(`🎬 Generating thumbnail for: ${articleId}`);
    
    // ffmpeg command to generate thumbnail
    // - First 5 seconds
    // - Scale to 480p width (height auto)
    // - 400k bitrate
    // - No audio
    const cmd = `ffmpeg -i "${videoPath}" -t 5 -vf "scale=480:-2" -b:v 400k -an -preset fast -y "${thumbnailPath}" -hide_banner -loglevel error`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Thumbnail generation failed for ${articleId}:`, error.message);
        return resolve(false);
      }
      
      if (fs.existsSync(thumbnailPath)) {
        const stats = fs.statSync(thumbnailPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`✓ Thumbnail generated for ${articleId}: ${sizeMB} MB`);
        resolve(true);
      } else {
        console.error(`❌ Thumbnail file not created for ${articleId}`);
        resolve(false);
      }
    });
  });
}

/**
 * Generate thumbnails for all videos that don't have them
 * @returns {Promise<{processed: number, skipped: number, failed: number}>}
 */
async function generateAllThumbnails() {
  const articlesDir = path.join(config.uploadDir, 'articles');
  
  if (!fs.existsSync(articlesDir)) {
    console.log('No articles directory found');
    return { processed: 0, skipped: 0, failed: 0 };
  }
  
  const videos = fs.readdirSync(articlesDir)
    .filter(f => f.startsWith('article-') && f.endsWith('.mp4'))
    .map(f => f.replace('.mp4', ''));
  
  console.log(`\n🎬 Generating thumbnails for ${videos.length} video(s)...`);
  
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const articleId of videos) {
    const thumbnailPath = path.join(config.uploadDir, 'thumbnails', `${articleId}.mp4`);
    
    if (fs.existsSync(thumbnailPath)) {
      skipped++;
      continue;
    }
    
    const success = await generateThumbnail(articleId);
    if (success) {
      processed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n✓ Thumbnail generation complete:`);
  console.log(`  Generated: ${processed}`);
  console.log(`  Skipped: ${skipped}`);
  if (failed > 0) {
    console.log(`  Failed: ${failed}`);
  }
  
  return { processed, skipped, failed };
}

module.exports = {
  generateThumbnail,
  generateAllThumbnails,
};
