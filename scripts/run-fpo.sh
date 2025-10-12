#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="prod"
ITERATIONS=1
EVOLUTION=true
EVOLUTION_INTERVAL=2

# Function to display help
show_help() {
    echo "Usage: ./scripts/run-fpo.sh [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "Run FPO (Federated Prompt Optimization) iterations"
    echo ""
    echo "Options:"
    echo "  -n, --iterations N      Number of iterations to run (default: 1)"
    echo "  --no-evolution          Disable prompt evolution (crossover)"
    echo "  --evolution-interval N  Evolve every N iterations (default: 2)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  ./scripts/run-fpo.sh                   # Run 1 iteration on prod"
    echo "  ./scripts/run-fpo.sh -n 10             # Run 10 iterations"
    echo "  ./scripts/run-fpo.sh -n 5 --no-evolution  # 5 iterations, no evolution"
    echo "  ./scripts/run-fpo.sh -n 20 dev         # 20 iterations on dev"
    echo ""
    echo "Notes:"
    echo "  - Each iteration uses a random article for evaluation (improves diversity)"
    echo "  - Uses queue system (button will be disabled during run)"
    echo "  - Check status with: ./scripts/status.sh --watch"
    echo "  - View results with: ./scripts/fpo-history.sh"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -n|--iterations)
            ITERATIONS="$2"
            shift 2
            ;;
        --no-evolution)
            EVOLUTION=false
            shift
            ;;
        --evolution-interval)
            EVOLUTION_INTERVAL="$2"
            shift 2
            ;;
        prod|dev)
            ENVIRONMENT=$1
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Validate iterations
if ! [[ "$ITERATIONS" =~ ^[0-9]+$ ]] || [ "$ITERATIONS" -lt 1 ]; then
    echo -e "${RED}Error: Iterations must be a positive number${NC}"
    exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Set BASE_URL based on environment
if [ "$ENVIRONMENT" = "prod" ]; then
    BASE_URL="https://api.reels.hurated.com"
else
    BASE_URL="http://localhost:${PORT:-15000}"
fi

echo -e "${YELLOW}=== Running FPO Optimization ($ENVIRONMENT) ===${NC}"
echo -e "${GRAY}$(date)${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "   Iterations: ${CYAN}$ITERATIONS${NC}"
echo -e "   Evolution: ${CYAN}$EVOLUTION${NC}"
if [ "$EVOLUTION" = "true" ]; then
    echo -e "   Evolution Interval: ${CYAN}$EVOLUTION_INTERVAL${NC}"
fi
echo ""

# Check if FPO is already running
echo -e "${GRAY}Checking if FPO is already running...${NC}"
flags_response=$(curl -s "$BASE_URL/api/flags/status" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Cannot connect to API${NC}"
    exit 1
fi

fpo_running=$(echo "$flags_response" | jq -r '.fpoRunning')

if [ "$fpo_running" = "true" ]; then
    echo -e "${RED}✗ FPO is already running!${NC}"
    echo -e "${YELLOW}Wait for current run to finish, or check: ./scripts/status.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✓ FPO is available${NC}"
echo ""

# Start FPO
echo -e "${BLUE}🚀 Starting FPO optimization...${NC}"
echo ""

request_body=$(jq -n \
    --arg iterations "$ITERATIONS" \
    --argjson evolution "$EVOLUTION" \
    --arg interval "$EVOLUTION_INTERVAL" \
    '{
        iterations: ($iterations | tonumber),
        enableEvolution: $evolution,
        evolutionInterval: ($interval | tonumber)
    }')

response=$(curl -s -X POST "$BASE_URL/api/fpo/run" \
    -H "Content-Type: application/json" \
    -d "$request_body" \
    2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ API request failed${NC}"
    exit 1
fi

# Check for errors
error=$(echo "$response" | jq -r '.error // empty')

if [ -n "$error" ]; then
    echo -e "${RED}✗ FPO Error:${NC} $error"
    exit 1
fi

# Parse results
success=$(echo "$response" | jq -r '.success')

if [ "$success" != "true" ]; then
    echo -e "${RED}✗ FPO failed${NC}"
    echo "$response" | jq .
    exit 1
fi

# Extract results
iterations_completed=$(echo "$response" | jq -r '.iterations')
final_prompt=$(echo "$response" | jq -r '.finalPrompt')
evolved_count=$(echo "$response" | jq -r '.evolved')
generation=$(echo "$response" | jq -r '.generation')

echo -e "${GREEN}✓ FPO Optimization Complete!${NC}"
echo ""
echo -e "${BLUE}📊 Results:${NC}"
echo -e "   Iterations Completed: ${GREEN}$iterations_completed${NC}"
echo -e "   Final Best Prompt: ${CYAN}$final_prompt${NC}"
echo -e "   Evolved Prompts: ${PURPLE}$evolved_count${NC}"
echo -e "   Max Generation: ${PURPLE}$generation${NC}"
echo ""

# Show top prompts
echo -e "${BLUE}🏆 Current Top Prompts:${NC}"
echo ""

prompts_response=$(curl -s "$BASE_URL/api/prompts" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$prompts_response" ]; then
    templates=$(echo "$prompts_response" | jq -r '.templates | sort_by(-.weight) | .[:5]')
    
    counter=1
    echo "$templates" | jq -c '.[]' | while IFS= read -r template; do
        id=$(echo "$template" | jq -r '.id')
        weight=$(echo "$template" | jq -r '.weight')
        generation=$(echo "$template" | jq -r '.generation // 0')
        
        # Performance data
        perf_array=$(echo "$template" | jq -r '.performance // []')
        sample_count=$(echo "$perf_array" | jq 'length')
        
        if [ "$sample_count" -gt 0 ]; then
            avg_score=$(echo "$perf_array" | jq '[.[].score] | add / length')
            score_display=$(printf "%.4f" $avg_score)
        else
            score_display="N/A"
        fi
        
        # Rank emoji
        if [ $counter -eq 1 ]; then
            rank_emoji="🏆"
        elif [ $counter -eq 2 ]; then
            rank_emoji="🥈"
        elif [ $counter -eq 3 ]; then
            rank_emoji="🥉"
        else
            rank_emoji="  "
        fi
        
        # Generation badge
        if [ "$generation" -gt 0 ]; then
            gen_badge="[Gen $generation]"
        else
            gen_badge="[Original]"
        fi
        
        echo -e "   ${rank_emoji} #$counter ${CYAN}$id${NC} ${PURPLE}$gen_badge${NC}"
        echo -e "      Weight: $(printf "%.6f" $weight) | Samples: $sample_count | Avg Score: $score_display"
        
        counter=$((counter + 1))
    done
else
    echo -e "   ${YELLOW}⚠ Could not fetch prompts data${NC}"
fi

echo ""
echo -e "${GRAY}View detailed history: ./scripts/fpo-history.sh${NC}"
echo -e "${GRAY}Monitor status: ./scripts/status.sh --watch${NC}"
echo ""
