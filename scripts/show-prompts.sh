#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
LIMIT=10
ENVIRONMENT="dev"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to display help
show_help() {
    echo "Usage: ./scripts/show-prompts.sh [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "Show best prompts ranked by weight"
    echo ""
    echo "Options:"
    echo "  -n, --limit NUMBER      Number of prompts to show (default: 10)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  dev                     Local dev server (default)"
    echo "  prod                    Production server"
    echo ""
    echo "Examples:"
    echo "  ./scripts/show-prompts.sh           # Show top 10 prompts (dev)"
    echo "  ./scripts/show-prompts.sh prod      # Show top 10 prompts (prod)"
    echo "  ./scripts/show-prompts.sh -n 5      # Show top 5 prompts"
    echo "  ./scripts/show-prompts.sh -n 3 prod # Show top 3 prompts (prod)"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -n|--limit)
            LIMIT=$2
            shift 2
            ;;
        dev|prod)
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

# Fetch and display prompts
echo -e "${YELLOW}=== Prompt Rankings ($ENVIRONMENT) ===${NC}"
echo ""

response=$(curl -s "$BASE_URL/api/fpo/status")

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to connect to $BASE_URL${NC}"
    exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed"
    echo "Install with: brew install jq"
    exit 1
fi

# Extract and display ranked prompts
echo "$response" | jq -r --arg limit "$LIMIT" '
    .templates 
    | sort_by(-.weight) 
    | limit($limit | tonumber; .[])
    | "\(.name) (\(.id)): \(.weight | tostring)"
' | while IFS= read -r line; do
    # Extract parts
    name=$(echo "$line" | cut -d':' -f1)
    weight=$(echo "$line" | cut -d':' -f2 | xargs)
    
    # Color based on weight
    if (( $(echo "$weight > 0" | bc -l) )); then
        color="${GREEN}"
    elif (( $(echo "$weight < 0" | bc -l) )); then
        color="${YELLOW}"
    else
        color="${NC}"
    fi
    
    echo -e "${color}${name}: ${weight}${NC}"
done

echo ""

# Show current global prompt
global_prompt=$(echo "$response" | jq -r '.globalPrompt')
echo -e "${BLUE}Current best: ${global_prompt}${NC}"
