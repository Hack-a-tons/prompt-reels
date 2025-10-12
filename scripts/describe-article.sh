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
ARTICLE_ID=""
THRESHOLD=0.3

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to display help
show_help() {
    echo "Usage: ./scripts/describe-article.sh ARTICLE_ID [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "Detect and describe scenes in article video"
    echo ""
    echo "Arguments:"
    echo "  ARTICLE_ID              Article ID to process"
    echo ""
    echo "Options:"
    echo "  -t, --threshold NUM     Scene detection threshold (default: 0.3)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  # Describe article video"
    echo "  ./scripts/describe-article.sh article-1234567890-123456"
    echo ""
    echo "  # With custom threshold"
    echo "  ./scripts/describe-article.sh article-1234567890-123456 -t 0.4"
    echo ""
    echo "  # On dev server"
    echo "  ./scripts/describe-article.sh article-1234567890-123456 dev"
    echo ""
    echo "What it does:"
    echo "  1. Detects scene changes in article video (ffmpeg)"
    echo "  2. Extracts key frames from each scene"
    echo "  3. Generates AI descriptions for each scene"
    echo "  4. Updates article status to 'described'"
    echo "  5. Links article to scene data"
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
        *)
            if [ -z "$ARTICLE_ID" ]; then
                ARTICLE_ID=$1
                shift
            else
                echo "Unknown option: $1"
                show_help
                exit 1
            fi
            ;;
    esac
done

# Check if article ID provided
if [ -z "$ARTICLE_ID" ]; then
    echo -e "${RED}Error: Article ID required${NC}"
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

echo -e "${YELLOW}=== Describe Article Video ($ENVIRONMENT) ===${NC}"
echo -e "${BLUE}Article ID: $ARTICLE_ID${NC}"
echo -e "${BLUE}Threshold: $THRESHOLD${NC}"
echo ""

# Build request body
request_body=$(cat <<EOF
{
  "threshold": $THRESHOLD
}
EOF
)

echo -e "${GRAY}POST $BASE_URL/api/articles/$ARTICLE_ID/describe${NC}"
echo -e "${GRAY}$request_body${NC}"
echo ""
echo -e "${YELLOW}This may take a few minutes...${NC}"
echo -e "${GRAY}Steps: Scene detection → Frame extraction → AI description${NC}"
echo ""

# Make request
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/articles/$ARTICLE_ID/describe" \
  -H "Content-Type: application/json" \
  -d "$request_body")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Check response
if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ Scene description complete!${NC}"
    echo ""
    
    # Parse response
    scene_count=$(echo "$body" | jq -r '.sceneCount')
    output_path=$(echo "$body" | jq -r '.outputPath')
    
    echo -e "${GREEN}Scenes detected: $scene_count${NC}"
    echo -e "${GRAY}Output: $output_path${NC}"
    echo ""
    
    echo -e "${BLUE}View scenes:${NC}"
    echo -e "  ${GRAY}$BASE_URL/api/scenes/$ARTICLE_ID${NC}"
    echo ""
    
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "  ${GRAY}# Rate video-article match:${NC}"
    echo -e "  ${GRAY}./scripts/rate-article.sh $ARTICLE_ID${NC}"
    
else
    echo -e "${RED}✗ Request failed (HTTP $http_code)${NC}"
    echo ""
    
    # Try to parse error
    error=$(echo "$body" | jq -r '.error' 2>/dev/null)
    if [ "$error" != "null" ] && [ -n "$error" ]; then
        echo -e "${RED}Error: $error${NC}"
    else
        echo "$body"
    fi
    
    exit 1
fi

echo ""
