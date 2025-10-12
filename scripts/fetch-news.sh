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
QUERY="latest news video"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to display help
show_help() {
    echo "Usage: ./scripts/fetch-news.sh [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "Fetch news articles with videos using Tavily and BrowserBase"
    echo ""
    echo "Options:"
    echo "  -q, --query TEXT        Search query (default: 'latest news video')"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  # Fetch latest news"
    echo "  ./scripts/fetch-news.sh"
    echo ""
    echo "  # Custom search query"
    echo "  ./scripts/fetch-news.sh -q 'technology news video'"
    echo ""
    echo "  # On dev server"
    echo "  ./scripts/fetch-news.sh dev"
    echo ""
    echo "What it does:"
    echo "  1. Searches Tavily for news articles (exponential backoff: 3, 6, 12, 24, 48, 96)"
    echo "  2. Extracts video URL from article page using BrowserBase"
    echo "  3. Downloads video to uploads/articles/ (skips blob: URLs)"
    echo "  4. Saves article metadata to output/articles/"
    echo "  5. Automatically retries with more articles if no video found"
    echo ""
    echo "Requirements:"
    echo "  - TAVILY_API_KEY in .env"
    echo "  - BROWSERBASE_API_KEY in .env"
    echo "  - BROWSERBASE_PROJECT_ID in .env"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -q|--query)
            QUERY=$2
            shift 2
            ;;
        prod|dev)
            ENVIRONMENT=$1
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

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

echo -e "${YELLOW}=== Fetch News Article ($ENVIRONMENT) ===${NC}"
echo -e "${BLUE}Query: $QUERY${NC}"
echo -e "${GRAY}Strategy: Exponential backoff (tries 3, 6, 12, 24, 48, 96 articles)${NC}"
echo ""

# Build request body
request_body=$(cat <<EOF
{
  "query": "$QUERY"
}
EOF
)

echo -e "${GRAY}POST $BASE_URL/api/fetch-news${NC}"
echo -e "${GRAY}$request_body${NC}"
echo ""
echo -e "${YELLOW}This may take a few minutes...${NC}"
echo -e "${GRAY}Steps: Tavily search → BrowserBase extraction → Video download${NC}"
echo ""

# Make request
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/fetch-news" \
  -H "Content-Type: application/json" \
  -d "$request_body")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Check response
if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ News article fetched successfully!${NC}"
    echo ""
    
    # Parse response
    article_id=$(echo "$body" | jq -r '.article.articleId')
    title=$(echo "$body" | jq -r '.article.title')
    source=$(echo "$body" | jq -r '.article.source.domain')
    video_url=$(echo "$body" | jq -r '.article.video.url')
    video_type=$(echo "$body" | jq -r '.article.video.type')
    local_path=$(echo "$body" | jq -r '.article.video.localPath')
    
    echo -e "${BLUE}Article Details:${NC}"
    echo -e "  ID: $article_id"
    echo -e "  Title: $title"
    echo -e "  Source: $source"
    echo -e "  Video Type: $video_type"
    echo ""
    
    if [ "$local_path" != "null" ]; then
        echo -e "${GREEN}✓ Video downloaded: $local_path${NC}"
        echo ""
        echo -e "${YELLOW}Next Steps:${NC}"
        echo ""
        echo -e "  ${GREEN}# Detect scenes in downloaded video${NC}"
        echo -e "  ./scripts/detect-scenes.sh $article_id"
        echo ""
        echo -e "  ${GREEN}# Extract frames + AI descriptions${NC}"
        echo -e "  ./scripts/describe-scenes.sh $article_id"
        echo ""
        echo -e "  ${GREEN}# View article details${NC}"
        echo -e "  curl $BASE_URL/api/articles/$article_id | jq ."
    else
        echo -e "${YELLOW}⚠ Video not downloaded (embedded video)${NC}"
        echo -e "  Video URL: $video_url"
        echo ""
        echo -e "${YELLOW}Note: Embedded videos (YouTube, Vimeo) need separate handling${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}View All Articles:${NC}"
    echo -e "  ./scripts/list.sh articles"
    
else
    echo -e "${RED}✗ News fetch failed ($http_code)${NC}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
fi
