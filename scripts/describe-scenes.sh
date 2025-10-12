#!/usr/bin/env bash

# Colors for output
GRAY='\033[0;90m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="prod"
THRESHOLD=0.4
VIDEO_ID=""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to display help
show_help() {
    echo "Usage: ./scripts/describe-scenes.sh [OPTIONS] VIDEO_ID [ENVIRONMENT]"
    echo ""
    echo "Extract frames and generate AI descriptions for detected scenes"
    echo ""
    echo "Arguments:"
    echo "  VIDEO_ID                Video ID from upload response"
    echo ""
    echo "Options:"
    echo "  -t, --threshold NUM     Scene change threshold (0.0-1.0, default: 0.4)"
    echo "                          Lower = more sensitive (more scenes)"
    echo "                          Higher = less sensitive (fewer scenes)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  # Extract frames + describe scenes"
    echo "  ./scripts/describe-scenes.sh video-1234567890"
    echo ""
    echo "  # Custom threshold"
    echo "  ./scripts/describe-scenes.sh -t 0.3 video-1234567890"
    echo ""
    echo "  # On dev server"
    echo "  ./scripts/describe-scenes.sh video-1234567890 dev"
    echo ""
    echo "What it does:"
    echo "  1. Detects scenes using ffmpeg (if not already detected)"
    echo "  2. Extracts 3 frames per scene (beginning, middle, end)"
    echo "  3. Generates AI descriptions using Azure OpenAI or Gemini"
    echo "  4. Saves results to output/<VIDEO_ID>_scenes.json"
    echo "  5. Updates visual viewer with descriptions"
    echo ""
    echo "View Results:"
    echo "  https://api.reels.hurated.com/api/scenes/<VIDEO_ID>"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--threshold)
            THRESHOLD=$2
            shift 2
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
            VIDEO_ID=$1
            shift
            ;;
    esac
done

# Check if VIDEO_ID is provided
if [ -z "$VIDEO_ID" ]; then
    echo -e "${RED}Error: VIDEO_ID is required${NC}"
    echo ""
    show_help
    exit 1
fi

# Set BASE_URL based on environment
if [ "$ENVIRONMENT" = "prod" ]; then
    BASE_URL="https://api.reels.hurated.com"
else
    BASE_URL="http://localhost:${PORT:-15000}"
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

echo -e "${YELLOW}=== Scene Description ($ENVIRONMENT) ===${NC}"
echo -e "${BLUE}Video ID: $VIDEO_ID${NC}"
echo -e "${BLUE}Threshold: $THRESHOLD${NC}"
echo -e "${BLUE}Extract Frames: true${NC}"
echo -e "${BLUE}AI Descriptions: true${NC}"
echo ""

# Build request body
request_body=$(cat <<EOF
{
  "videoId": "$VIDEO_ID",
  "threshold": $THRESHOLD,
  "extractFrames": true,
  "describeScenes": true
}
EOF
)

echo -e "${GRAY}POST $BASE_URL/api/detect-scenes${NC}"
echo -e "${GRAY}$request_body${NC}"
echo ""

echo -e "${YELLOW}This may take a few minutes...${NC}"
echo -e "${GRAY}Processing: scene detection → frame extraction → AI descriptions${NC}"
echo ""

# Make request
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/detect-scenes" \
  -H "Content-Type: application/json" \
  -d "$request_body")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Check response
if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ Scene description successful!${NC}"
    echo ""
    
    # Parse response
    scene_count=$(echo "$body" | jq -r '.sceneCount')
    output_path=$(echo "$body" | jq -r '.outputPath')
    
    echo -e "${BLUE}Results:${NC}"
    echo -e "  Scenes: $scene_count"
    echo -e "  Output: $output_path"
    echo ""
    
    # Show scene list with descriptions
    echo -e "${YELLOW}Scenes with Descriptions:${NC}"
    echo ""
    
    echo "$body" | jq -r '.scenes[] | 
        "Scene \(.sceneId):
   Time: \(.start)s - \(.end)s (duration: \(.duration)s)
   Frames: \(.frames | length)
   Description: \(.description // "N/A")
"'
    
    # Show frame info
    echo ""
    echo -e "${YELLOW}Extracted Frames:${NC}"
    echo ""
    
    total_frames=$(echo "$body" | jq '[.scenes[].frames | length] | add')
    echo -e "${GREEN}Total frames extracted: $total_frames${NC}"
    echo ""
    
    echo "$body" | jq -r '.scenes[] | 
        "Scene \(.sceneId):" as $scene |
        .frames[] | 
        "  \(.frameId): \(.timestamp)s"' | head -10
    
    if [ "$total_frames" -gt 10 ]; then
        echo "  ..."
    fi
    
    echo ""
    echo -e "${YELLOW}View Results:${NC}"
    echo ""
    echo -e "  ${GREEN}# Visual viewer with video + frames + descriptions${NC}"
    echo -e "  ${BLUE}$BASE_URL/api/scenes/$VIDEO_ID${NC}"
    echo ""
    echo -e "  ${GREEN}# JSON data${NC}"
    echo -e "  cat $output_path | jq ."
    echo ""
    echo -e "  ${GREEN}# List detected scenes${NC}"
    echo -e "  ./scripts/detected.sh $VIDEO_ID"
    
else
    echo -e "${RED}✗ Scene description failed ($http_code)${NC}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
fi
