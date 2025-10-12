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
VIDEO_FILE=""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to display help
show_help() {
    echo "Usage: ./scripts/upload.sh VIDEO_FILE [ENVIRONMENT]"
    echo ""
    echo "Upload a video file and get VIDEO_ID"
    echo ""
    echo "Arguments:"
    echo "  VIDEO_FILE              Path to video file (mp4, avi, mov, mkv, webm)"
    echo "  ENVIRONMENT             prod (default) or dev"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "                          https://api.reels.hurated.com"
    echo "  dev                     Local dev server"
    echo "                          http://localhost:PORT"
    echo ""
    echo "Examples:"
    echo "  # Upload to production"
    echo "  ./scripts/upload.sh video.mp4"
    echo ""
    echo "  # Upload to dev"
    echo "  ./scripts/upload.sh video.mp4 dev"
    echo ""
    echo "Returns:"
    echo "  VIDEO_ID - Use this with detect-scenes.sh, analyze, etc."
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
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
            VIDEO_FILE=$1
            shift
            ;;
    esac
done

# Check if VIDEO_FILE is provided
if [ -z "$VIDEO_FILE" ]; then
    echo -e "${RED}Error: VIDEO_FILE is required${NC}"
    echo ""
    show_help
    exit 1
fi

# Check if file exists
if [ ! -f "$VIDEO_FILE" ]; then
    echo -e "${RED}Error: File not found: $VIDEO_FILE${NC}"
    exit 1
fi

# Set BASE_URL based on environment
if [ "$ENVIRONMENT" = "prod" ]; then
    BASE_URL="https://api.reels.hurated.com"
else
    BASE_URL="http://localhost:${PORT:-15000}"
fi

# Get file info
FILE_SIZE=$(ls -lh "$VIDEO_FILE" | awk '{print $5}')
FILE_NAME=$(basename "$VIDEO_FILE")

echo -e "${YELLOW}=== Upload Video ($ENVIRONMENT) ===${NC}"
echo -e "${BLUE}File: $FILE_NAME${NC}"
echo -e "${BLUE}Size: $FILE_SIZE${NC}"
echo ""

echo -e "${GRAY}POST $BASE_URL/api/upload${NC}"
echo -e "${GRAY}Uploading...${NC}"
echo ""

# Upload file
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/upload" \
  -F "video=@$VIDEO_FILE")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Check response
if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ Upload successful!${NC}"
    echo ""
    
    # Parse response
    video_id=$(echo "$body" | jq -r '.videoId')
    filename=$(echo "$body" | jq -r '.filename')
    size=$(echo "$body" | jq -r '.size')
    
    # Format size
    size_mb=$(echo "scale=2; $size / 1048576" | bc)
    
    echo -e "${BLUE}Results:${NC}"
    echo -e "  Video ID: ${GREEN}$video_id${NC}"
    echo -e "  Filename: $filename"
    echo -e "  Size: ${size_mb}MB"
    echo ""
    
    # Show next steps
    echo -e "${YELLOW}Next Steps:${NC}"
    echo ""
    echo -e "  ${BLUE}# Detect scenes${NC}"
    echo -e "  ./scripts/detect-scenes.sh $video_id"
    echo ""
    echo -e "  ${BLUE}# Detect scenes with frame extraction${NC}"
    echo -e "  ./scripts/detect-scenes.sh -f $video_id"
    echo ""
    echo -e "  ${BLUE}# Analyze video${NC}"
    echo -e "  curl -X POST $BASE_URL/api/analyze \\"
    echo -e "    -H \"Content-Type: application/json\" \\"
    echo -e "    -d '{\"videoId\":\"$video_id\"}'"
    echo ""
    
    # Save VIDEO_ID to a temp file for easy access
    echo "$video_id" > /tmp/prompt-reels-latest-video-id
    echo -e "${GRAY}💡 Tip: Latest VIDEO_ID saved to /tmp/prompt-reels-latest-video-id${NC}"
    
else
    echo -e "${RED}✗ Upload failed ($http_code)${NC}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
fi
