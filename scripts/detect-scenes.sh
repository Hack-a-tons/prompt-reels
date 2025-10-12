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
EXTRACT_FRAMES=false
VIDEO_ID=""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to display help
show_help() {
    echo "Usage: ./scripts/detect-scenes.sh [OPTIONS] VIDEO_ID [ENVIRONMENT]"
    echo ""
    echo "Detect scenes in a video using ffmpeg scene detection"
    echo ""
    echo "Arguments:"
    echo "  VIDEO_ID                Video ID from upload response"
    echo ""
    echo "Options:"
    echo "  -t, --threshold NUM     Scene change threshold (0.0-1.0, default: 0.4)"
    echo "                          Lower = more sensitive (more scenes)"
    echo "                          Higher = less sensitive (fewer scenes)"
    echo "  -f, --frames            Extract 3 frames per scene + AI descriptions"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  # Basic scene detection"
    echo "  ./scripts/detect-scenes.sh video-1234567890"
    echo ""
    echo "  # With frame extraction"
    echo "  ./scripts/detect-scenes.sh -f video-1234567890"
    echo ""
    echo "  # Custom threshold (more sensitive)"
    echo "  ./scripts/detect-scenes.sh -t 0.3 video-1234567890"
    echo ""
    echo "  # On dev server"
    echo "  ./scripts/detect-scenes.sh video-1234567890 dev"
    echo ""
    echo "Scene Detection:"
    echo "  - Uses ffmpeg scene filter to detect cuts/transitions"
    echo "  - Returns JSON with scene timestamps (start, end, duration)"
    echo "  - Optionally extracts 3 frames per scene (10%, 50%, 90%)"
    echo "  - Threshold: 0.4 works well for most videos"
    echo "  - Results saved to output/<VIDEO_ID>_scenes.json"
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
        -f|--frames)
            EXTRACT_FRAMES=true
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

echo -e "${YELLOW}=== Scene Detection ($ENVIRONMENT) ===${NC}"
echo -e "${BLUE}Video ID: $VIDEO_ID${NC}"
echo -e "${BLUE}Threshold: $THRESHOLD${NC}"
echo -e "${BLUE}Extract Frames: $EXTRACT_FRAMES${NC}"
echo ""

# Build request body (with scene descriptions if extracting frames)
request_body=$(cat <<EOF
{
  "videoId": "$VIDEO_ID",
  "threshold": $THRESHOLD,
  "extractFrames": $EXTRACT_FRAMES,
  "describeScenes": $EXTRACT_FRAMES
}
EOF
)

echo -e "${GRAY}POST $BASE_URL/api/detect-scenes${NC}"
echo -e "${GRAY}$request_body${NC}"
echo ""

# Make request
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/detect-scenes" \
  -H "Content-Type: application/json" \
  -d "$request_body")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Check response
if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ Scene detection successful!${NC}"
    echo ""
    
    # Parse response
    scene_count=$(echo "$body" | jq -r '.sceneCount')
    output_path=$(echo "$body" | jq -r '.outputPath')
    
    echo -e "${BLUE}Results:${NC}"
    echo -e "  Scenes detected: $scene_count"
    echo -e "  Output file: $output_path"
    echo ""
    
    # Show scene list
    echo -e "${YELLOW}Scene List:${NC}"
    echo ""
    
    echo "$body" | jq -r '.scenes[] | 
        "Scene \(.sceneId):
   Start: \(.start)s
   End: \(.end)s
   Duration: \(.duration)s\(if .frames then "
   Frames: \(.frames | length)" else "" end)\(if .description then "
   Description: \(.description)" else "" end)
"'
    
    # Show frame info if extracted
    if [ "$EXTRACT_FRAMES" = true ]; then
        echo ""
        echo -e "${YELLOW}Extracted Frames:${NC}"
        echo ""
        
        total_frames=$(echo "$body" | jq '[.scenes[].frames | length] | add')
        echo -e "${GREEN}Total frames extracted: $total_frames${NC}"
        echo ""
        
        echo "$body" | jq -r '.scenes[] | 
            "Scene \(.sceneId):" as $scene |
            .frames[] | 
            "  Frame \(.frameId): \(.timestamp)s -> \(.relativePath)"'
    fi
    
    echo ""
    echo -e "${YELLOW}View results:${NC}"
    echo -e "  cat $output_path | jq ."
    
else
    echo -e "${RED}✗ Scene detection failed ($http_code)${NC}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
fi
