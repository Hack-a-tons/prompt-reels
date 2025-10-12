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
TARGET="videos"

# Function to display help
show_help() {
    echo "Usage: ./scripts/list.sh [TARGET] [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "List uploaded videos or fetched articles"
    echo ""
    echo "Targets:"
    echo "  videos                  List uploaded videos (default)"
    echo "  articles                List fetched news articles"
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
    echo "  ./scripts/list.sh                   # List videos on prod"
    echo "  ./scripts/list.sh videos            # Same as above"
    echo "  ./scripts/list.sh articles          # List articles"
    echo "  ./scripts/list.sh articles dev      # List articles on dev"
    echo "  ./scripts/list.sh -f                # Show full filenames"
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
        videos|articles)
            TARGET=$1
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

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Set BASE_URL based on environment
if [ "$ENVIRONMENT" = "prod" ]; then
    BASE_URL="https://api.reels.hurated.com"
else
    BASE_URL="http://localhost:${PORT:-15000}"
fi

# List articles using API
if [ "$TARGET" = "articles" ]; then
    echo -e "${YELLOW}=== Fetched Articles ($ENVIRONMENT) ===${NC}"
    echo ""
    
    response=$(curl -s "$BASE_URL/api/articles")
    count=$(echo "$response" | jq -r '.count')
    
    if [ "$count" = "0" ] || [ "$count" = "null" ]; then
        echo -e "${BLUE}No articles found${NC}"
        echo ""
        echo -e "${GRAY}# Fetch a news article:${NC}"
        echo -e "${GRAY}./scripts/fetch-news.sh${NC}"
        exit 0
    fi
    
    echo -e "${BLUE}Total: $count article(s)${NC}"
    echo ""
    
    # Display articles
    echo "$response" | jq -r '.articles[] | @json' | while IFS= read -r article; do
        article_id=$(echo "$article" | jq -r '.articleId')
        title=$(echo "$article" | jq -r '.title')
        source=$(echo "$article" | jq -r '.source')
        video_type=$(echo "$article" | jq -r '.videoType')
        has_local=$(echo "$article" | jq -r '.hasLocalVideo')
        fetched=$(echo "$article" | jq -r '.fetchedAt')
        
        # Truncate title if not showing full
        display_title="$title"
        if [ "$SHOW_FULL" = false ] && [ ${#title} -gt 60 ]; then
            display_title="${title:0:57}..."
        fi
        
        echo -e "${GREEN}$article_id${NC}"
        echo -e "   Title: $display_title"
        echo -e "   Source: $source"
        echo -e "   Video: $video_type"
        
        if [ "$has_local" = "true" ]; then
            echo -e "   ${GREEN}✓ Video downloaded${NC}"
            echo -e "   ${GRAY}# Detect scenes:${NC}"
            echo -e "   ${GRAY}./scripts/detect-scenes.sh $article_id${NC}"
        else
            echo -e "   ${YELLOW}○ Embedded video (not downloaded)${NC}"
        fi
        
        echo -e "   Fetched: $fetched"
        echo ""
    done
    
    exit 0
fi

# List videos
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
