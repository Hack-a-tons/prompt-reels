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
ITERATIONS=5
EVOLUTION_INTERVAL=2
ENABLE_EVOLUTION=true
COMMAND=""
VIDEO_FILE=""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to display help
show_help() {
    echo "Usage: ./evolve.sh [COMMAND] [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "Manage prompt evolution (Federated Prompt Optimization)"
    echo ""
    echo "Commands:"
    echo "  start                   Start prompt evolution"
    echo "  status                  Get current evolution status"
    echo "  show                    Show current prompts (alias for status)"
    echo ""
    echo "Options:"
    echo "  -n, --iterations NUM    Number of iterations (default: 5)"
    echo "  -i, --interval NUM      Evolution interval (default: 2)"
    echo "  --no-evolution          Disable evolution (testing only)"
    echo "  -v, --video FILE        Upload video first, then evolve"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  # Start evolution on production (5 iterations)"
    echo "  ./evolve.sh start"
    echo ""
    echo "  # Start with 7 iterations, evolve every 2 rounds"
    echo "  ./evolve.sh start -n 7 -i 2"
    echo ""
    echo "  # Upload video and then evolve"
    echo "  ./evolve.sh start -v sample.mp4"
    echo ""
    echo "  # Run on dev server"
    echo "  ./evolve.sh start dev"
    echo ""
    echo "  # Check evolution status"
    echo "  ./evolve.sh status"
    echo ""
    echo "Evolution Process:"
    echo "  - Iteration 1: Test original prompts"
    echo "  - Iteration 2: Test + Create Gen 1 (breed top 2 prompts)"
    echo "  - Iteration 3: Test 6 prompts (5 original + 1 evolved)"
    echo "  - Iteration 4: Test + Create Gen 2"
    echo "  - Continue..."
    echo ""
    echo "Results stored in: data/prompts.json"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        start|status|show)
            COMMAND=$1
            shift
            ;;
        -n|--iterations)
            ITERATIONS=$2
            shift 2
            ;;
        -i|--interval)
            EVOLUTION_INTERVAL=$2
            shift 2
            ;;
        --no-evolution)
            ENABLE_EVOLUTION=false
            shift
            ;;
        -v|--video)
            VIDEO_FILE=$2
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

# Default to status if no command
if [ -z "$COMMAND" ]; then
    COMMAND="status"
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Function to upload video
upload_video() {
    local video_path=$1
    
    if [ ! -f "$video_path" ]; then
        echo -e "${RED}Error: Video file not found: $video_path${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Uploading video: $video_path${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/upload" \
        -F "video=@$video_path")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        video_id=$(echo "$body" | jq -r '.videoId')
        echo -e "${GREEN}✓ Video uploaded: $video_id${NC}"
        
        # Analyze video to extract frames
        echo -e "${YELLOW}Analyzing video...${NC}"
        analyze_response=$(curl -s -X POST "$BASE_URL/api/analyze" \
            -H "Content-Type: application/json" \
            -d "{\"videoId\":\"$video_id\"}")
        
        echo -e "${GREEN}✓ Video analyzed${NC}"
        echo ""
    else
        echo -e "${RED}✗ Upload failed ($http_code)${NC}"
        echo "$body"
        exit 1
    fi
}

# Function to start evolution
start_evolution() {
    echo -e "${YELLOW}=== Starting Prompt Evolution ($ENVIRONMENT) ===${NC}"
    echo -e "${BLUE}Iterations: $ITERATIONS${NC}"
    echo -e "${BLUE}Evolution Interval: every $EVOLUTION_INTERVAL iterations${NC}"
    echo -e "${BLUE}Evolution Enabled: $ENABLE_EVOLUTION${NC}"
    echo ""
    
    # Upload video if specified
    if [ -n "$VIDEO_FILE" ]; then
        upload_video "$VIDEO_FILE"
    fi
    
    # Start FPO
    echo -e "${YELLOW}Starting evolution process...${NC}"
    echo -e "${GRAY}This will take approximately $(($ITERATIONS * 2)) minutes${NC}"
    echo ""
    
    request_body=$(cat <<EOF
{
  "iterations": $ITERATIONS,
  "enableEvolution": $ENABLE_EVOLUTION,
  "evolutionInterval": $EVOLUTION_INTERVAL
}
EOF
)
    
    echo -e "${GRAY}POST $BASE_URL/api/fpo/run${NC}"
    echo -e "${GRAY}$request_body${NC}"
    echo ""
    
    response=$(curl -s -X POST "$BASE_URL/api/fpo/run" \
        -H "Content-Type: application/json" \
        -d "$request_body")
    
    # Check if response is valid JSON
    if ! echo "$response" | jq empty 2>/dev/null; then
        echo -e "${RED}Error: Invalid response from server${NC}"
        echo "$response"
        exit 1
    fi
    
    success=$(echo "$response" | jq -r '.success')
    
    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✓ Evolution completed!${NC}"
        echo ""
        
        iterations_done=$(echo "$response" | jq -r '.iterations')
        final_prompt=$(echo "$response" | jq -r '.finalPrompt')
        evolved_count=$(echo "$response" | jq -r '.evolved // 0')
        generation=$(echo "$response" | jq -r '.generation // 0')
        
        echo -e "${BLUE}Results:${NC}"
        echo -e "  Iterations: $iterations_done"
        echo -e "  Best prompt: $final_prompt"
        echo -e "  Evolved prompts: $evolved_count"
        echo -e "  Max generation: $generation"
        echo ""
        
        echo -e "${YELLOW}View detailed results:${NC}"
        echo -e "  ./scripts/evolve.sh status $ENVIRONMENT"
        echo -e "  ./scripts/show-prompts.sh $ENVIRONMENT"
    else
        echo -e "${RED}✗ Evolution failed${NC}"
        error=$(echo "$response" | jq -r '.error // "Unknown error"')
        echo -e "${RED}Error: $error${NC}"
        exit 1
    fi
}

# Function to show status
show_status() {
    echo -e "${YELLOW}=== Prompt Evolution Status ($ENVIRONMENT) ===${NC}"
    echo ""
    
    response=$(curl -s "$BASE_URL/api/fpo/status")
    
    if ! echo "$response" | jq empty 2>/dev/null; then
        echo -e "${RED}Error: Could not connect to $BASE_URL${NC}"
        exit 1
    fi
    
    global_prompt=$(echo "$response" | jq -r '.globalPrompt')
    pop_size=$(echo "$response" | jq -r '.populationSize')
    max_gen=$(echo "$response" | jq -r '.maxGeneration')
    
    echo -e "${BLUE}Current Best:${NC} $global_prompt"
    echo -e "${BLUE}Population Size:${NC} $pop_size prompts"
    echo -e "${BLUE}Max Generation:${NC} $max_gen"
    echo ""
    
    # Count evolved prompts
    evolved_count=$(echo "$response" | jq '[.templates[] | select(.generation > 0)] | length')
    original_count=$(echo "$response" | jq '[.templates[] | select(.generation == 0)] | length')
    
    echo -e "${BLUE}Composition:${NC}"
    echo -e "  Original prompts: $original_count"
    echo -e "  Evolved prompts: $evolved_count"
    echo ""
    
    # Show top 5 prompts
    echo -e "${YELLOW}Top 5 Prompts:${NC}"
    echo ""
    
    counter=1
    echo "$response" | jq -r '.templates | sort_by(-.weight) | limit(5; .[]) | 
        {name, id, weight, generation: (.generation // 0), parents: (.parents // [])} | 
        @json' | while read -r prompt; do
        name=$(echo "$prompt" | jq -r '.name')
        id=$(echo "$prompt" | jq -r '.id')
        weight=$(echo "$prompt" | jq -r '.weight')
        generation=$(echo "$prompt" | jq -r '.generation')
        parents=$(echo "$prompt" | jq -r '.parents | join(", ")')
        
        echo -e "${GREEN}$counter. $name ($id)${NC}"
        echo -e "   Weight: $weight"
        if [ "$generation" != "0" ]; then
            echo -e "   Generation: $generation"
            if [ -n "$parents" ]; then
                echo -e "   Parents: $parents"
            fi
        fi
        echo ""
        
        counter=$((counter + 1))
    done
    
    echo ""
    echo -e "${YELLOW}Data stored in:${NC} data/prompts.json"
    echo -e "${YELLOW}View at:${NC} https://wandb.ai/prompt-reels"
}

# Execute command
case $COMMAND in
    start)
        start_evolution
        ;;
    status|show)
        show_status
        ;;
    *)
        echo "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac
