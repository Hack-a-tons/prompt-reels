#!/bin/bash

# Analyze a user-uploaded video
# Usage: ./scripts/analyze-video.sh <video-file> [server]
# server: "prod" (default) or "dev"

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Error: Video file required${NC}"
    echo "Usage: $0 <video-file> [server]"
    echo ""
    echo "Examples:"
    echo "  $0 video.mp4          # Analyze on production"
    echo "  $0 video.mp4 dev      # Analyze on dev server"
    exit 1
fi

VIDEO_FILE="$1"
SERVER="${2:-prod}"

# Check if file exists
if [ ! -f "$VIDEO_FILE" ]; then
    echo -e "${RED}Error: File not found: $VIDEO_FILE${NC}"
    exit 1
fi

# Determine API URL
if [ "$SERVER" = "dev" ]; then
    API_URL="http://localhost:15000"
    echo -e "${BLUE}Using dev server${NC}"
else
    API_URL="https://reels.hurated.com"
    echo -e "${BLUE}Using production server${NC}"
fi

echo -e "${YELLOW}Analyzing video: $(basename "$VIDEO_FILE")${NC}"
echo ""

# Step 1: Upload video
echo -e "${BLUE}Step 1/3: Uploading video...${NC}"
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/upload" \
    -F "video=@$VIDEO_FILE")

# Extract video ID
VIDEO_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"videoId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$VIDEO_ID" ]; then
    echo -e "${RED}Upload failed!${NC}"
    echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Video uploaded: $VIDEO_ID${NC}"
echo ""

# Step 2: Detect scenes
echo -e "${BLUE}Step 2/3: Detecting scenes...${NC}"
DETECT_RESPONSE=$(curl -s -X POST "$API_URL/api/detect-scenes" \
    -H "Content-Type: application/json" \
    -d "{
        \"videoId\": \"$VIDEO_ID\",
        \"threshold\": 0.4,
        \"extractFrames\": true,
        \"describeScenes\": false
    }")

SCENE_COUNT=$(echo "$DETECT_RESPONSE" | grep -o '"sceneCount":[0-9]*' | cut -d':' -f2)

if [ -z "$SCENE_COUNT" ]; then
    echo -e "${RED}Scene detection failed!${NC}"
    echo "$DETECT_RESPONSE" | jq '.' 2>/dev/null || echo "$DETECT_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Detected $SCENE_COUNT scenes${NC}"
echo ""

# Step 3: Generate descriptions
echo -e "${BLUE}Step 3/3: Generating AI descriptions (this may take a while)...${NC}"
DESCRIBE_RESPONSE=$(curl -s -X POST "$API_URL/api/detect-scenes" \
    -H "Content-Type: application/json" \
    -d "{
        \"videoId\": \"$VIDEO_ID\",
        \"threshold\": 0.4,
        \"extractFrames\": false,
        \"describeScenes\": true
    }")

SUCCESS=$(echo "$DESCRIBE_RESPONSE" | grep -o '"success":true')

if [ -z "$SUCCESS" ]; then
    echo -e "${YELLOW}Warning: AI description may have failed${NC}"
    echo "$DESCRIBE_RESPONSE" | jq '.' 2>/dev/null || echo "$DESCRIBE_RESPONSE"
fi

echo -e "${GREEN}✓ Analysis complete!${NC}"
echo ""

# Display results
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Video analyzed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Video ID: $VIDEO_ID"
echo "Scenes:   $SCENE_COUNT"
echo ""
echo "View results:"
echo -e "${BLUE}$API_URL/api/scenes/$VIDEO_ID${NC}"
echo ""
