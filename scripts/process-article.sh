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
QUERY="latest news video"

# Function to display help
show_help() {
    echo "Usage: ./scripts/process-article.sh [ENVIRONMENT] [OPTIONS]"
    echo ""
    echo "Complete pipeline: Fetch → Describe → Rate"
    echo ""
    echo "Environment:"
    echo "  dev                     Localhost (http://localhost:3000)"
    echo "  prod                    Production (https://reels.hurated.com) [default]"
    echo ""
    echo "Options:"
    echo "  -q, --query QUERY       Search query (default: 'latest news video')"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/process-article.sh                         # Production, default query"
    echo "  ./scripts/process-article.sh dev                     # Development"
    echo "  ./scripts/process-article.sh -q \"technology news\"    # Custom query"
    echo "  ./scripts/process-article.sh prod -q \"sports video\"  # Production + custom query"
    echo ""
    echo "What it does:"
    echo "  1. Fetch news article with video (Tavily + BrowserBase)"
    echo "  2. Describe video scenes (scene detection + AI descriptions)"
    echo "  3. Rate video-article match (AI rating 0-100)"
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
            QUERY="$2"
            shift 2
            ;;
        dev|prod)
            ENVIRONMENT=$1
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}=== Article Processing Pipeline ===${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Query: \"$QUERY\"${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Step 1: Fetch news article
echo -e "${YELLOW}[1/3] Fetching news article...${NC}"
ARTICLE_ID=$(bash "$SCRIPT_DIR/fetch-news.sh" "$ENVIRONMENT" -q "$QUERY" | grep -o 'article-[0-9]*-[0-9]*' | head -1)

if [ -z "$ARTICLE_ID" ]; then
    echo -e "${RED}✗ Failed to fetch article${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Article fetched: $ARTICLE_ID${NC}"
echo ""

# Step 2: Describe scenes
echo -e "${YELLOW}[2/3] Describing video scenes...${NC}"
DESCRIBE_RESULT=$(bash "$SCRIPT_DIR/describe-article.sh" "$ARTICLE_ID" "$ENVIRONMENT")

if echo "$DESCRIBE_RESULT" | grep -q "Error\|Failed"; then
    echo -e "${RED}✗ Failed to describe scenes${NC}"
    echo "$DESCRIBE_RESULT"
    exit 1
fi

SCENE_COUNT=$(echo "$DESCRIBE_RESULT" | grep -o '[0-9]* scene' | head -1 | grep -o '[0-9]*')
echo -e "${GREEN}✓ Scenes described: $SCENE_COUNT scenes${NC}"
echo ""

# Step 3: Rate article-video match
echo -e "${YELLOW}[3/3] Rating video-article match...${NC}"
RATE_RESULT=$(bash "$SCRIPT_DIR/rate-article.sh" "$ARTICLE_ID" "$ENVIRONMENT")

if echo "$RATE_RESULT" | grep -q "Error\|Failed"; then
    echo -e "${RED}✗ Failed to rate match${NC}"
    echo "$RATE_RESULT"
    exit 1
fi

MATCH_SCORE=$(echo "$RATE_RESULT" | grep -o 'Score: [0-9]*' | head -1 | grep -o '[0-9]*')
echo -e "${GREEN}✓ Match rated: $MATCH_SCORE/100${NC}"
echo ""

# Summary
echo -e "${GREEN}=== Pipeline Complete! ===${NC}"
echo ""
echo -e "${BLUE}Article ID:${NC}    $ARTICLE_ID"
echo -e "${BLUE}Scenes:${NC}        $SCENE_COUNT"
echo -e "${BLUE}Match Score:${NC}   $MATCH_SCORE/100"
echo ""

# Show URLs
if [ "$ENVIRONMENT" = "dev" ]; then
    BASE_URL="http://localhost:3000"
else
    BASE_URL="https://reels.hurated.com"
fi

echo -e "${YELLOW}View results:${NC}"
echo -e "  ${GRAY}Article:${NC}  $BASE_URL/articles/$ARTICLE_ID"
echo -e "  ${GRAY}Scenes:${NC}   $BASE_URL/api/scenes/$ARTICLE_ID"
echo ""
