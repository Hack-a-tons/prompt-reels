#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="prod"
SHOW_FULL=false

# Function to display help
show_help() {
    echo "Usage: ./scripts/list.sh [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "List uploaded videos and their IDs"
    echo ""
    echo "Options:"
    echo "  -f, --full              Show full filenames (not truncated)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  ./scripts/list.sh              # List videos on prod"
    echo "  ./scripts/list.sh dev          # List videos on dev"
    echo "  ./scripts/list.sh -f           # Show full filenames"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--full)
            SHOW_FULL=true
            shift
            ;;
        prod|dev)
            ENVIRONMENT=$1
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            shift
            ;;
    esac
done

echo -e "${YELLOW}=== Uploaded Videos ($ENVIRONMENT) ===${NC}"
echo ""

# List files via SSH for prod, locally for dev
if [ "$ENVIRONMENT" = "prod" ]; then
    # SSH to server and list files
    FILES=$(ssh reels.hurated.com "ls -lh prompt-reels/uploads/video-*.* 2>/dev/null" 2>/dev/null)
    
    if [ -z "$FILES" ]; then
        echo -e "${BLUE}No videos found${NC}"
        exit 0
    fi
    
    echo -e "${BLUE}Location: reels.hurated.com:~/prompt-reels/uploads/${NC}"
else
    # List local files
    if [ ! -d "uploads" ]; then
        echo -e "${BLUE}No uploads directory${NC}"
        exit 0
    fi
    
    FILES=$(ls -lh uploads/video-*.* 2>/dev/null)
    
    if [ -z "$FILES" ]; then
        echo -e "${BLUE}No videos found${NC}"
        exit 0
    fi
    
    echo -e "${BLUE}Location: $(pwd)/uploads/${NC}"
fi

echo ""

# Parse and display files
counter=1
echo "$FILES" | while read -r line; do
    # Extract fields from ls -lh output
    size=$(echo "$line" | awk '{print $5}')
    date=$(echo "$line" | awk '{print $6, $7, $8}')
    filename=$(echo "$line" | awk '{print $9}')
    
    # Skip if not a file line
    if [ -z "$filename" ] || [[ "$filename" == "total" ]]; then
        continue
    fi
    
    # Extract basename
    basename=$(basename "$filename")
    
    # Extract VIDEO_ID (remove extension)
    video_id="${basename%.*}"
    
    # Truncate long IDs if not showing full
    display_id="$video_id"
    if [ "$SHOW_FULL" = false ] && [ ${#video_id} -gt 40 ]; then
        display_id="${video_id:0:30}...${video_id: -7}"
    fi
    
    echo -e "${GREEN}$counter. $display_id${NC}"
    echo -e "   Size: $size"
    echo -e "   Date: $date"
    
    # Check if scenes were detected
    if [ "$ENVIRONMENT" = "prod" ]; then
        HAS_SCENES=$(ssh reels.hurated.com "test -f prompt-reels/output/${video_id}_scenes.json && echo yes || echo no" 2>/dev/null)
    else
        HAS_SCENES=$(test -f "output/${video_id}_scenes.json" && echo yes || echo no)
    fi
    
    if [ "$HAS_SCENES" = "yes" ]; then
        if [ "$ENVIRONMENT" = "prod" ]; then
            SCENE_COUNT=$(ssh reels.hurated.com "cat prompt-reels/output/${video_id}_scenes.json" 2>/dev/null | jq -r '.sceneCount')
        else
            SCENE_COUNT=$(cat "output/${video_id}_scenes.json" 2>/dev/null | jq -r '.sceneCount')
        fi
        echo -e "   ${GREEN}✓ Scenes: $SCENE_COUNT${NC}"
        echo -e "   ${GRAY}https://api.reels.hurated.com/api/scenes/$video_id${NC}"
    else
        echo -e "   ${YELLOW}○ No scenes detected${NC}"
    fi
    
    # Show usage commands
    if [ $counter -eq 1 ]; then
        echo ""
        echo -e "   ${GRAY}# Detect & describe scenes:${NC}"
        echo -e "   ${GRAY}./scripts/detect-scenes.sh $video_id${NC}"
        echo -e "   ${GRAY}./scripts/describe-scenes.sh $video_id${NC}"
    fi
    
    echo ""
    
    counter=$((counter + 1))
done

# Count total
total=$(echo "$FILES" | grep -c "video-")
echo -e "${BLUE}Total: $total video(s)${NC}"

# Show latest VIDEO_ID if exists
if [ -f /tmp/prompt-reels-latest-video-id ]; then
    latest=$(cat /tmp/prompt-reels-latest-video-id)
    echo ""
    echo -e "${GRAY}💡 Latest uploaded: $latest${NC}"
fi
