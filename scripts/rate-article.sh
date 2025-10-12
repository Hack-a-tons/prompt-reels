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

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to display help
show_help() {
    echo "Usage: ./scripts/rate-article.sh ARTICLE_ID [ENVIRONMENT]"
    echo ""
    echo "Rate how well the video matches the article content"
    echo ""
    echo "Arguments:"
    echo "  ARTICLE_ID              Article ID to rate"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  # Rate article video match"
    echo "  ./scripts/rate-article.sh article-1234567890-123456"
    echo ""
    echo "  # On dev server"
    echo "  ./scripts/rate-article.sh article-1234567890-123456 dev"
    echo ""
    echo "What it does:"
    echo "  1. Compares article text with scene descriptions"
    echo "  2. Uses AI to rate how well video illustrates article (0-100)"
    echo "  3. Updates article status to 'rated'"
    echo "  4. Saves rating and explanation"
    echo ""
    echo "Prerequisites:"
    echo "  - Article must be 'described' (run describe-article.sh first)"
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

echo -e "${YELLOW}=== Rate Article Video Match ($ENVIRONMENT) ===${NC}"
echo -e "${BLUE}Article ID: $ARTICLE_ID${NC}"
echo ""

echo -e "${GRAY}POST $BASE_URL/api/articles/$ARTICLE_ID/rate${NC}"
echo ""
echo -e "${YELLOW}Analyzing video-article match with AI...${NC}"
echo ""

# Make request
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/articles/$ARTICLE_ID/rate" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Check response
if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ Rating complete!${NC}"
    echo ""
    
    # Parse response
    match_score=$(echo "$body" | jq -r '.matchScore')
    rating=$(echo "$body" | jq -r '.rating')
    
    # Color code the score
    if [ "$match_score" -ge 70 ]; then
        score_color=$GREEN
    elif [ "$match_score" -ge 40 ]; then
        score_color=$YELLOW
    else
        score_color=$RED
    fi
    
    echo -e "${score_color}Match Score: $match_score/100${NC}"
    echo ""
    echo -e "${GRAY}AI Rating:${NC}"
    echo "$rating" | sed 's/^/  /'
    echo ""
    
    echo -e "${BLUE}View details:${NC}"
    echo -e "  ${GRAY}$BASE_URL/api/articles/$ARTICLE_ID${NC}"
    echo -e "  ${GRAY}$BASE_URL/api/scenes/$ARTICLE_ID${NC}"
    
else
    echo -e "${RED}✗ Request failed (HTTP $http_code)${NC}"
    echo ""
    
    # Try to parse error
    error=$(echo "$body" | jq -r '.error' 2>/dev/null)
    if [ "$error" != "null" ] && [ -n "$error" ]; then
        echo -e "${RED}Error: $error${NC}"
        
        # Provide helpful hint if article not described
        if echo "$error" | grep -q "no scene descriptions"; then
            echo ""
            echo -e "${YELLOW}Hint: Run describe-article.sh first:${NC}"
            echo -e "  ${GRAY}./scripts/describe-article.sh $ARTICLE_ID${NC}"
        fi
    else
        echo "$body"
    fi
    
    exit 1
fi

echo ""
