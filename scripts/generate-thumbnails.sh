#!/usr/bin/env bash

# Generate video thumbnails for dashboard
# Creates small, optimized preview videos from full-size originals

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ARTICLES_DIR="$PROJECT_DIR/uploads/articles"
THUMBNAILS_DIR="$PROJECT_DIR/uploads/thumbnails"

# Thumbnail settings
DURATION=5           # First 5 seconds
WIDTH=480            # 480p width (height auto-calculated)
BITRATE="400k"       # Target bitrate
TARGET_SIZE_MB=2     # Target max size in MB

echo -e "${YELLOW}=== Video Thumbnail Generator ===${NC}"
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}Error: ffmpeg is required but not installed${NC}"
    echo "Install with: brew install ffmpeg"
    exit 1
fi

# Create thumbnails directory
mkdir -p "$THUMBNAILS_DIR"
echo -e "${BLUE}Thumbnails directory: $THUMBNAILS_DIR${NC}"
echo ""

# Find all article videos
if [ ! -d "$ARTICLES_DIR" ]; then
    echo -e "${RED}Error: Articles directory not found: $ARTICLES_DIR${NC}"
    exit 1
fi

videos=($(find "$ARTICLES_DIR" -name "article-*.mp4" -type f))

if [ ${#videos[@]} -eq 0 ]; then
    echo -e "${YELLOW}No videos found in $ARTICLES_DIR${NC}"
    exit 0
fi

echo -e "${GREEN}Found ${#videos[@]} video(s)${NC}"
echo ""

# Process each video
processed=0
skipped=0
failed=0

for video_path in "${videos[@]}"; do
    filename=$(basename "$video_path")
    thumbnail_path="$THUMBNAILS_DIR/$filename"
    
    # Check if thumbnail already exists
    if [ -f "$thumbnail_path" ]; then
        echo -e "${GRAY}⏭️  Skipping $filename (thumbnail exists)${NC}"
        skipped=$((skipped + 1))
        continue
    fi
    
    echo -e "${YELLOW}🎬 Processing: $filename${NC}"
    
    # Get original video size
    original_size=$(du -h "$video_path" | cut -f1)
    echo -e "   Original size: $original_size"
    
    # Generate thumbnail
    # - Extract first N seconds (-t $DURATION)
    # - Scale to 480p width, maintain aspect ratio (-vf scale)
    # - Set video bitrate (-b:v)
    # - Remove audio (-an)
    # - Fast encoding (-preset fast)
    # - Overwrite without asking (-y)
    if ffmpeg -i "$video_path" \
        -t $DURATION \
        -vf "scale=${WIDTH}:-2" \
        -b:v $BITRATE \
        -an \
        -preset fast \
        -y \
        "$thumbnail_path" \
        -hide_banner -loglevel error 2>&1; then
        
        # Get thumbnail size
        thumb_size=$(du -h "$thumbnail_path" | cut -f1)
        thumb_size_mb=$(du -m "$thumbnail_path" | cut -f1)
        
        if [ $thumb_size_mb -gt $TARGET_SIZE_MB ]; then
            echo -e "   ${YELLOW}⚠️  Thumbnail size: ${thumb_size} (larger than ${TARGET_SIZE_MB}MB)${NC}"
        else
            echo -e "   ${GREEN}✓ Thumbnail size: ${thumb_size}${NC}"
        fi
        
        processed=$((processed + 1))
    else
        echo -e "   ${RED}✗ Failed to generate thumbnail${NC}"
        failed=$((failed + 1))
    fi
    
    echo ""
done

# Summary
echo -e "${YELLOW}=== Summary ===${NC}"
echo -e "${GREEN}✓ Generated: $processed${NC}"
echo -e "${GRAY}⏭️  Skipped: $skipped${NC}"
if [ $failed -gt 0 ]; then
    echo -e "${RED}✗ Failed: $failed${NC}"
fi

# Calculate total sizes
if [ $processed -gt 0 ] || [ $skipped -gt 0 ]; then
    total_original=$(du -sh "$ARTICLES_DIR" | cut -f1)
    total_thumbs=$(du -sh "$THUMBNAILS_DIR" | cut -f1)
    echo ""
    echo -e "${BLUE}Storage:${NC}"
    echo -e "  Original videos: $total_original"
    echo -e "  Thumbnails: $total_thumbs"
fi

echo ""
echo -e "${GREEN}✓ Done!${NC}"
