#!/bin/bash

# Video Deletion Script
# Usage: ./scripts/delete-videos.sh video-123 video-456 article-789

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect environment
if command -v docker &> /dev/null && docker ps &> /dev/null; then
    ENV="production"
    UPLOAD_DIR="/root/prompt-reels/uploads"
    OUTPUT_DIR="/root/prompt-reels/output"
    USE_SSH=false
    echo -e "${BLUE}Environment: Production (Docker detected, local)${NC}"
else
    # Check if we can SSH to production server
    if ssh -o ConnectTimeout=2 -o BatchMode=yes reels.hurated.com "exit" &> /dev/null; then
        ENV="production"
        UPLOAD_DIR="/root/prompt-reels/uploads"
        OUTPUT_DIR="/root/prompt-reels/output"
        USE_SSH=true
        echo -e "${BLUE}Environment: Production (via SSH from dev machine)${NC}"
    else
        ENV="development"
        UPLOAD_DIR="./uploads"
        OUTPUT_DIR="./output"
        USE_SSH=false
        echo -e "${BLUE}Environment: Development (local)${NC}"
    fi
fi

# Check if video IDs provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No video IDs provided${NC}"
    echo ""
    echo "Usage: ./scripts/delete-videos.sh <videoId1> [videoId2] [videoId3] ..."
    echo ""
    echo "Examples:"
    echo "  ./scripts/delete-videos.sh video-1760641286615-438255319"
    echo "  ./scripts/delete-videos.sh article-1760297096441-246 video-1760623387995-820"
    echo ""
    exit 1
fi

VIDEO_IDS=("$@")

# Helper function to check if file exists (works with SSH or local)
file_exists() {
    local path="$1"
    if [ "$USE_SSH" = true ]; then
        ssh reels.hurated.com "[ -f '$path' ]" 2>/dev/null
    else
        [ -f "$path" ]
    fi
}

# Helper function to check if directory exists (works with SSH or local)
dir_exists() {
    local path="$1"
    if [ "$USE_SSH" = true ]; then
        ssh reels.hurated.com "[ -d '$path' ]" 2>/dev/null
    else
        [ -d "$path" ]
    fi
}

# Helper function to count files in directory (works with SSH or local)
count_files() {
    local path="$1"
    if [ "$USE_SSH" = true ]; then
        ssh reels.hurated.com "find '$path' -type f 2>/dev/null | wc -l" 2>/dev/null || echo "0"
    else
        find "$path" -type f 2>/dev/null | wc -l || echo "0"
    fi
}

# Helper function to get file size (works with SSH or local)
get_file_size() {
    local path="$1"
    if [ "$USE_SSH" = true ]; then
        ssh reels.hurated.com "du -h '$path' 2>/dev/null | cut -f1" 2>/dev/null || echo "?"
    else
        du -h "$path" 2>/dev/null | cut -f1 || echo "?"
    fi
}

# Helper function to delete file/directory (works with SSH or local)
delete_path() {
    local path="$1"
    local is_dir="$2"
    
    if [ "$USE_SSH" = true ]; then
        if [ "$is_dir" = true ]; then
            ssh reels.hurated.com "rm -rf '$path'" 2>/dev/null
        else
            ssh reels.hurated.com "rm -f '$path'" 2>/dev/null
        fi
    else
        if [ "$is_dir" = true ]; then
            rm -rf "$path" 2>/dev/null
        else
            rm -f "$path" 2>/dev/null
        fi
    fi
}

echo ""
echo -e "${YELLOW}=== Video Deletion Preview ===${NC}"
echo ""

# Array to store all files to delete
declare -a FILES_TO_DELETE

# Check each video ID and collect files
for VIDEO_ID in "${VIDEO_IDS[@]}"; do
    echo -e "${BLUE}Scanning for: ${VIDEO_ID}${NC}"
    
    # Determine video type
    if [[ $VIDEO_ID == article-* ]]; then
        VIDEO_TYPE="article"
        VIDEO_PATH="${UPLOAD_DIR}/articles/${VIDEO_ID}.mp4"
    elif [[ $VIDEO_ID == video-* ]]; then
        VIDEO_TYPE="user-upload"
        VIDEO_PATH="${UPLOAD_DIR}/${VIDEO_ID}.mp4"
    else
        echo -e "${RED}  ✗ Invalid video ID format: ${VIDEO_ID}${NC}"
        echo "    Must start with 'article-' or 'video-'"
        continue
    fi
    
    # Check if video exists
    if ! file_exists "$VIDEO_PATH"; then
        echo -e "${YELLOW}  ⚠ Video file not found: ${VIDEO_PATH}${NC}"
    else
        echo -e "  ${GREEN}✓${NC} Video file: ${VIDEO_PATH}"
        FILES_TO_DELETE+=("$VIDEO_PATH")
    fi
    
    # Check for thumbnail
    THUMBNAIL_PATH="${UPLOAD_DIR}/thumbnails/${VIDEO_ID}.mp4"
    if file_exists "$THUMBNAIL_PATH"; then
        echo -e "  ${GREEN}✓${NC} Thumbnail: ${THUMBNAIL_PATH}"
        FILES_TO_DELETE+=("$THUMBNAIL_PATH")
    fi
    
    # Check for thumbnail lock file
    LOCK_PATH="${UPLOAD_DIR}/thumbnails/${VIDEO_ID}.lock"
    if file_exists "$LOCK_PATH"; then
        echo -e "  ${GREEN}✓${NC} Lock file: ${LOCK_PATH}"
        FILES_TO_DELETE+=("$LOCK_PATH")
    fi
    
    # Check for scene data JSON
    SCENES_JSON="${OUTPUT_DIR}/${VIDEO_ID}_scenes.json"
    if file_exists "$SCENES_JSON"; then
        echo -e "  ${GREEN}✓${NC} Scene data: ${SCENES_JSON}"
        FILES_TO_DELETE+=("$SCENES_JSON")
    fi
    
    # Check for scene frames directory
    SCENES_DIR="${OUTPUT_DIR}/${VIDEO_ID}_scenes"
    if dir_exists "$SCENES_DIR"; then
        FRAME_COUNT=$(count_files "$SCENES_DIR")
        echo -e "  ${GREEN}✓${NC} Scene frames: ${SCENES_DIR} (${FRAME_COUNT} files)"
        FILES_TO_DELETE+=("$SCENES_DIR")
    fi
    
    # Check for descriptions JSON
    DESCRIPTIONS_JSON="${OUTPUT_DIR}/${VIDEO_ID}_descriptions.json"
    if file_exists "$DESCRIPTIONS_JSON"; then
        echo -e "  ${GREEN}✓${NC} Descriptions: ${DESCRIPTIONS_JSON}"
        FILES_TO_DELETE+=("$DESCRIPTIONS_JSON")
    fi
    
    # Check for article metadata (for articles only)
    if [[ $VIDEO_TYPE == "article" ]]; then
        ARTICLE_JSON="${UPLOAD_DIR}/articles/${VIDEO_ID}.json"
        if file_exists "$ARTICLE_JSON"; then
            echo -e "  ${GREEN}✓${NC} Article metadata: ${ARTICLE_JSON}"
            FILES_TO_DELETE+=("$ARTICLE_JSON")
        fi
    fi
    
    echo ""
done

# Show summary
TOTAL_FILES=${#FILES_TO_DELETE[@]}

if [ $TOTAL_FILES -eq 0 ]; then
    echo -e "${YELLOW}No files found to delete.${NC}"
    exit 0
fi

echo -e "${YELLOW}=== Deletion Summary ===${NC}"
echo -e "Total items to delete: ${RED}${TOTAL_FILES}${NC}"
echo ""

# Show detailed list
echo -e "${YELLOW}Files and directories to be deleted:${NC}"
for FILE in "${FILES_TO_DELETE[@]}"; do
    if dir_exists "$FILE"; then
        echo -e "  ${RED}[DIR]${NC}  $FILE"
    else
        SIZE=$(get_file_size "$FILE")
        echo -e "  ${RED}[FILE]${NC} $FILE (${SIZE})"
    fi
done

echo ""
echo -e "${RED}⚠️  WARNING: This action cannot be undone!${NC}"
echo ""

# Ask for confirmation
read -p "Are you sure you want to delete these files? (type 'yes' to confirm): " CONFIRMATION

if [ "$CONFIRMATION" != "yes" ]; then
    echo -e "${GREEN}Deletion cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}=== Deleting Files ===${NC}"

# Delete files
DELETED_COUNT=0
FAILED_COUNT=0

for FILE in "${FILES_TO_DELETE[@]}"; do
    IS_DIR=false
    if dir_exists "$FILE"; then
        IS_DIR=true
    fi
    
    if delete_path "$FILE" "$IS_DIR"; then
        if [ "$IS_DIR" = true ]; then
            echo -e "  ${GREEN}✓${NC} Deleted directory: $FILE"
        else
            echo -e "  ${GREEN}✓${NC} Deleted file: $FILE"
        fi
        ((DELETED_COUNT++))
    else
        if [ "$IS_DIR" = true ]; then
            echo -e "  ${RED}✗${NC} Failed to delete directory: $FILE"
        else
            echo -e "  ${RED}✗${NC} Failed to delete file: $FILE"
        fi
        ((FAILED_COUNT++))
    fi
done

echo ""
echo -e "${GREEN}=== Deletion Complete ===${NC}"
echo -e "Successfully deleted: ${GREEN}${DELETED_COUNT}${NC} items"
if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "Failed to delete: ${RED}${FAILED_COUNT}${NC} items"
fi

echo ""
