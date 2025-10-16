# Scripts Documentation

## Video Management Scripts

### delete-videos.sh

Delete videos and all related files from the system.

**⚠️ WARNING:** This script permanently deletes files. Use with caution!

#### Usage

```bash
./scripts/delete-videos.sh <videoId1> [videoId2] [videoId3] ...
```

#### Examples

**Delete a single video:**
```bash
./scripts/delete-videos.sh video-1760641286615-438255319
```

**Delete multiple videos:**
```bash
./scripts/delete-videos.sh video-123 video-456 article-789
```

**Run on production server via SSH:**
```bash
ssh reels.hurated.com "cd prompt-reels && ./scripts/delete-videos.sh video-123"
```

#### What It Deletes

For each video ID, the script removes:

1. **Video file:**
   - User uploads: `uploads/video-*.mp4`
   - Articles: `uploads/articles/article-*.mp4`

2. **Thumbnail files:**
   - `uploads/thumbnails/{videoId}.mp4`
   - `uploads/thumbnails/{videoId}.lock` (if exists)

3. **Scene data:**
   - `output/{videoId}_scenes.json`
   - `output/{videoId}_scenes/` (directory with frames)
   - `output/{videoId}_descriptions.json`

4. **Article metadata** (for articles only):
   - `uploads/articles/{videoId}.json`

#### Safety Features

✅ **Preview before deletion** - Shows all files that will be deleted  
✅ **Confirmation required** - Must type 'yes' to proceed  
✅ **Environment detection** - Detects dev vs prod automatically  
✅ **Size display** - Shows file sizes before deletion  
✅ **Error handling** - Reports success/failure for each file  
✅ **Dry-run capability** - Review before confirming  

#### Environment Detection

The script automatically detects the environment:

- **Production:** Docker is available and running
  - Paths: `/root/prompt-reels/uploads`, `/root/prompt-reels/output`
- **Development:** No Docker detected
  - Paths: `./uploads`, `./output`

#### Example Output

```bash
$ ./scripts/delete-videos.sh video-1760641286615-438255319

Environment: Production (Docker detected)

=== Video Deletion Preview ===

Scanning for: video-1760641286615-438255319
  ✓ Video file: /root/prompt-reels/uploads/video-1760641286615-438255319.mp4
  ✓ Thumbnail: /root/prompt-reels/uploads/thumbnails/video-1760641286615-438255319.mp4
  ✓ Scene data: /root/prompt-reels/output/video-1760641286615-438255319_scenes.json
  ✓ Scene frames: /root/prompt-reels/output/video-1760641286615-438255319_scenes (99 files)

=== Deletion Summary ===
Total items to delete: 4

Files and directories to be deleted:
  [FILE] /root/prompt-reels/uploads/video-1760641286615-438255319.mp4 (45M)
  [FILE] /root/prompt-reels/uploads/thumbnails/video-1760641286615-438255319.mp4 (1.2M)
  [FILE] /root/prompt-reels/output/video-1760641286615-438255319_scenes.json (24K)
  [DIR]  /root/prompt-reels/output/video-1760641286615-438255319_scenes

⚠️  WARNING: This action cannot be undone!

Are you sure you want to delete these files? (type 'yes' to confirm): yes

=== Deleting Files ===
  ✓ Deleted file: /root/prompt-reels/uploads/video-1760641286615-438255319.mp4
  ✓ Deleted file: /root/prompt-reels/uploads/thumbnails/video-1760641286615-438255319.mp4
  ✓ Deleted file: /root/prompt-reels/output/video-1760641286615-438255319_scenes.json
  ✓ Deleted directory: /root/prompt-reels/output/video-1760641286615-438255319_scenes

=== Deletion Complete ===
Successfully deleted: 4 items
```

#### Remote Execution

**On production server:**
```bash
# From your local machine
ssh reels.hurated.com "cd prompt-reels && ./scripts/delete-videos.sh video-123"

# Interactive confirmation still required
```

**Multiple videos:**
```bash
ssh reels.hurated.com "cd prompt-reels && ./scripts/delete-videos.sh video-123 video-456"
```

#### Error Handling

If a video ID is invalid:
```
✗ Invalid video ID format: invalid-123
  Must start with 'article-' or 'video-'
```

If no files found:
```
No files found to delete.
```

If deletion fails:
```
✗ Failed to delete file: /path/to/file
Failed to delete: 1 items
```

## Other Scripts

### deploy.sh

Deploy the application to production.

```bash
./scripts/deploy.sh -s  # Silent mode
```

### detect-scenes.sh

Manually detect scenes for a video (if exists).

```bash
./scripts/detect-scenes.sh -f video-123
```

---

## Notes

- All scripts should be run from the project root directory
- Scripts automatically detect environment (dev/prod)
- Use `-h` or `--help` flag for detailed help (if supported)
- Check script comments for additional configuration options
