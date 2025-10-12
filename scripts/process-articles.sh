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
TARGET_COUNT=10
QUERY="latest news video"

# Function to display help
show_help() {
    echo "Usage: ./scripts/process-articles.sh [COUNT] [ENVIRONMENT] [OPTIONS]"
    echo ""
    echo "Process multiple articles until target count is reached"
    echo ""
    echo "Arguments:"
    echo "  COUNT                   Number of articles to add (1-100, default: 10)"
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
    echo "  ./scripts/process-articles.sh                    # Add 10 articles (prod)"
    echo "  ./scripts/process-articles.sh 5                  # Add 5 articles"
    echo "  ./scripts/process-articles.sh 20 dev             # Add 20 articles (dev)"
    echo "  ./scripts/process-articles.sh 15 -q \"tech news\"  # Custom query"
    echo ""
    echo "How it works:"
    echo "  1. Checks current article count"
    echo "  2. Runs process-article.sh until target reached"
    echo "  3. Accounts for duplicates and errors"
    echo "  4. Stops when target count achieved"
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
        [0-9]|[0-9][0-9]|100)
            TARGET_COUNT=$1
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Validate target count
if [ "$TARGET_COUNT" -lt 1 ] || [ "$TARGET_COUNT" -gt 100 ]; then
    echo -e "${RED}Error: COUNT must be between 1 and 100${NC}"
    exit 1
fi

# Set base URL
if [ "$ENVIRONMENT" = "dev" ]; then
    BASE_URL="http://localhost:3000"
else
    BASE_URL="https://reels.hurated.com"
fi

# Get current article count
get_article_count() {
    curl -s "$BASE_URL/api/dashboard" | jq -r '.count' 2>/dev/null || echo "0"
}

echo -e "${YELLOW}=== Process Multiple Articles ===${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Target: Add $TARGET_COUNT new articles${NC}"
echo -e "${BLUE}Query: \"$QUERY\"${NC}"
echo ""

# Get initial count
INITIAL_COUNT=$(get_article_count)
echo -e "${GRAY}Current articles: $INITIAL_COUNT${NC}"
TARGET_TOTAL=$((INITIAL_COUNT + TARGET_COUNT))
echo -e "${GRAY}Target total: $TARGET_TOTAL${NC}"
echo ""

# Track attempts and successes
ATTEMPTS=0
ADDED=0
MAX_ATTEMPTS=$((TARGET_COUNT * 10))  # Allow up to 10x attempts (for duplicates/errors)

while [ $ADDED -lt $TARGET_COUNT ]; do
    ATTEMPTS=$((ATTEMPTS + 1))
    
    # Safety check: don't run forever
    if [ $ATTEMPTS -gt $MAX_ATTEMPTS ]; then
        echo -e "${RED}⚠️  Max attempts ($MAX_ATTEMPTS) reached${NC}"
        echo -e "${YELLOW}Added $ADDED out of $TARGET_COUNT articles${NC}"
        break
    fi
    
    echo -e "${YELLOW}[Attempt $ATTEMPTS] Processing article ($ADDED/$TARGET_COUNT added so far)...${NC}"
    
    # Get count before
    BEFORE_COUNT=$(get_article_count)
    
    # Run process-article.sh
    if [ "$ENVIRONMENT" = "dev" ]; then
        ./scripts/process-article.sh dev -q "$QUERY" > /dev/null 2>&1
    else
        ./scripts/process-article.sh prod -q "$QUERY" > /dev/null 2>&1
    fi
    
    RESULT=$?
    
    # Wait a bit for the article to be saved
    sleep 2
    
    # Get count after
    AFTER_COUNT=$(get_article_count)
    
    # Check if article was added
    if [ $AFTER_COUNT -gt $BEFORE_COUNT ]; then
        ADDED=$((ADDED + 1))
        echo -e "${GREEN}✓ Article added! Total: $AFTER_COUNT ($ADDED new)${NC}"
        echo ""
    else
        if [ $RESULT -eq 0 ]; then
            echo -e "${YELLOW}⊘ Skipped (likely duplicate)${NC}"
        else
            echo -e "${RED}✗ Failed (error code: $RESULT)${NC}"
        fi
        echo ""
    fi
done

# Final summary
FINAL_COUNT=$(get_article_count)
echo -e "${GREEN}=== Complete! ===${NC}"
echo ""
echo -e "${BLUE}Initial count:${NC}  $INITIAL_COUNT"
echo -e "${BLUE}Final count:${NC}    $FINAL_COUNT"
echo -e "${BLUE}Added:${NC}          $ADDED articles"
echo -e "${BLUE}Attempts:${NC}       $ATTEMPTS"
echo ""

if [ $ADDED -ge $TARGET_COUNT ]; then
    echo -e "${GREEN}✓ Target reached! ($ADDED/$TARGET_COUNT)${NC}"
else
    echo -e "${YELLOW}⚠️  Partial success ($ADDED/$TARGET_COUNT)${NC}"
fi
