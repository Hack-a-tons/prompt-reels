#!/bin/bash

# Fetch article from a specific URL (bypasses Tavily, uses BrowserBase only)
# Usage: ./scripts/fetch-from-url.sh <URL> [dev]

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
  export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

# Determine server based on argument
if [ "$2" == "dev" ] || [ "$1" == "dev" ]; then
  SERVER="http://localhost:${PORT:-15000}"
  echo "Using dev server: $SERVER"
else
  SERVER="https://reels.hurated.com"
  echo "Using production server: $SERVER"
fi

# Get URL from argument
if [ "$1" == "dev" ] || [ -z "$1" ]; then
  echo "Error: URL is required"
  echo ""
  echo "Usage: $0 <URL> [dev]"
  echo ""
  echo "Examples:"
  echo "  $0 https://www.cnn.com/2025/01/10/tech/video-news/index.html"
  echo "  $0 https://www.nbcnews.com/news/world/helicopter-crash-video dev"
  echo ""
  echo "This endpoint bypasses Tavily and uses BrowserBase directly."
  exit 1
fi

URL="$1"

echo ""
echo "🔗 Fetching article from URL..."
echo "   URL: $URL"
echo ""

# Make API request
response=$(curl -s -X POST "$SERVER/api/fetch-from-url" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$URL\"}")

# Check if successful
if echo "$response" | grep -q '"success":true'; then
  echo "✓ Success!"
  
  # Extract article ID
  articleId=$(echo "$response" | grep -o '"articleId":"[^"]*"' | cut -d'"' -f4)
  title=$(echo "$response" | grep -o '"title":"[^"]*"' | head -1 | cut -d'"' -f4 | head -c 60)
  
  echo ""
  echo "Article ID: $articleId"
  echo "Title: $title..."
  echo ""
  echo "Next steps:"
  echo "  ./scripts/detect-scenes.sh $articleId"
  echo "  ./scripts/describe-scenes.sh $articleId"
  echo ""
  
  if [ "$2" != "dev" ] && [ "$1" != "dev" ]; then
    echo "View in browser:"
    echo "  https://reels.hurated.com/articles/$articleId"
  fi
else
  echo "❌ Failed to fetch article"
  echo ""
  echo "Response:"
  echo "$response" | jq . 2>/dev/null || echo "$response"
  exit 1
fi
