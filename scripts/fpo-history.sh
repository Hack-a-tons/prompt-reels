#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
GRAY='\033[0;90m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="prod"
SHOW_DETAILS=false
TOP_N=10

# Function to display help
show_help() {
    echo "Usage: ./scripts/fpo-history.sh [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "Show FPO optimization history and prompt performance"
    echo ""
    echo "Options:"
    echo "  -d, --details           Show detailed performance data"
    echo "  -n, --top N             Show top N prompts (default: 10)"
    echo "  -a, --all               Show all prompts"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  ./scripts/fpo-history.sh                   # Show top 10 prompts on prod"
    echo "  ./scripts/fpo-history.sh -d                # Show with details"
    echo "  ./scripts/fpo-history.sh -n 5              # Show top 5"
    echo "  ./scripts/fpo-history.sh --all             # Show all prompts"
    echo "  ./scripts/fpo-history.sh dev               # Show on dev server"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--details)
            SHOW_DETAILS=true
            shift
            ;;
        -n|--top)
            TOP_N="$2"
            shift 2
            ;;
        -a|--all)
            TOP_N=999
            shift
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

echo -e "${YELLOW}=== FPO Optimization History ($ENVIRONMENT) ===${NC}"
echo -e "${GRAY}$(date)${NC}"
echo ""

# Get prompts data
prompts_response=$(curl -s "$BASE_URL/api/prompts" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$prompts_response" ]; then
    echo -e "${RED}✗ Cannot connect to API${NC}"
    exit 1
fi

# Parse data
global_prompt=$(echo "$prompts_response" | jq -r '.global_prompt')
template_count=$(echo "$prompts_response" | jq -r '.templates | length')

echo -e "${BLUE}📊 Overview${NC}"
echo -e "   Global Prompt: ${GREEN}$global_prompt${NC}"
echo -e "   Total Prompts: ${CYAN}$template_count${NC}"
echo ""

# Get templates sorted by weight
templates=$(echo "$prompts_response" | jq -r '.templates | sort_by(-.weight) | .[]' | jq -s '.')

# Count by generation
gen0_count=$(echo "$templates" | jq '[.[] | select(.generation == 0)] | length')
gen1plus_count=$(echo "$templates" | jq '[.[] | select(.generation > 0)] | length')

echo -e "${BLUE}🧬 Population Composition${NC}"
echo -e "   Generation 0 (Original): ${CYAN}$gen0_count${NC}"
echo -e "   Generation 1+ (Evolved): ${PURPLE}$gen1plus_count${NC}"
echo ""

# Show top prompts
echo -e "${BLUE}🏆 Top $TOP_N Prompts (by weight)${NC}"
echo ""

counter=1
echo "$templates" | jq -c '.[]' | head -n "$TOP_N" | while IFS= read -r template; do
    id=$(echo "$template" | jq -r '.id')
    weight=$(echo "$template" | jq -r '.weight')
    generation=$(echo "$template" | jq -r '.generation // 0')
    created=$(echo "$template" | jq -r '.created // "unknown"')
    
    # Performance data
    perf_array=$(echo "$template" | jq -r '.performance // []')
    sample_count=$(echo "$perf_array" | jq 'length')
    
    # Calculate average score if samples exist
    if [ "$sample_count" -gt 0 ]; then
        avg_score=$(echo "$perf_array" | jq '[.[].score] | add / length')
    else
        avg_score="N/A"
    fi
    
    # Template text (truncated)
    template_text=$(echo "$template" | jq -r '.template')
    if [ ${#template_text} -gt 100 ]; then
        template_text="${template_text:0:97}..."
    fi
    
    # Color coding
    if [ $counter -eq 1 ]; then
        rank_color=$GREEN
        rank_emoji="🏆"
    elif [ $counter -eq 2 ]; then
        rank_color=$YELLOW
        rank_emoji="🥈"
    elif [ $counter -eq 3 ]; then
        rank_color=$BLUE
        rank_emoji="🥉"
    else
        rank_color=$NC
        rank_emoji=""
    fi
    
    # Generation badge
    if [ "$generation" -gt 0 ]; then
        gen_badge="${PURPLE}[Gen $generation]${NC}"
        
        # Show parents if available
        parents=$(echo "$template" | jq -r '.parents // [] | join(", ")')
        if [ -n "$parents" ] && [ "$parents" != "" ]; then
            parent_info=" ${GRAY}(parents: $parents)${NC}"
        else
            parent_info=""
        fi
    else
        gen_badge="${GRAY}[Original]${NC}"
        parent_info=""
    fi
    
    echo -e "${rank_color}${rank_emoji} #$counter ${CYAN}$id${NC} ${PURPLE}$gen_badge${NC}"
    echo -e "   Weight: $(printf "%.6f" $weight) | Samples: $sample_count | Avg Score: $(printf "%.4f" $avg_score)"
    echo -e "   Template: \"$template_text\""
    fi
    
    if [ "$SHOW_DETAILS" = true ]; then
        echo -e "   Created: $created"
        echo -e "   ${GRAY}Prompt: \"$template_text\"${NC}"
        
        if [ "$sample_count" -gt 0 ]; then
            echo -e "   ${GRAY}Performance History:${NC}"
            echo "$perf_array" | jq -c '.[]' | head -n 5 | while IFS= read -r perf; do
                score=$(echo "$perf" | jq -r '.score')
                timestamp=$(echo "$perf" | jq -r '.timestamp // "unknown"')
                article_id=$(echo "$perf" | jq -r '.articleId // "N/A"')
                echo -e "      ${GRAY}• Score: $(printf "%.4f" $score) | $timestamp | $article_id${NC}"
            done
            
            if [ "$sample_count" -gt 5 ]; then
                echo -e "      ${GRAY}... and $((sample_count - 5)) more${NC}"
            fi
        fi
    fi
    
    echo ""
    counter=$((counter + 1))
done

# Summary statistics
echo -e "${BLUE}📈 Statistics${NC}"

# Get all weights
weights=$(echo "$templates" | jq '[.[].weight]')
best_weight=$(echo "$weights" | jq 'max')
worst_weight=$(echo "$weights" | jq 'min')
avg_weight=$(echo "$weights" | jq 'add / length')

# Get all samples
total_samples=$(echo "$templates" | jq '[.[].performance // [] | length] | add')

echo -e "   Best Weight: ${GREEN}$(printf "%.6f" $best_weight)${NC}"
echo -e "   Worst Weight: ${RED}$(printf "%.6f" $worst_weight)${NC}"
echo -e "   Average Weight: ${CYAN}$(printf "%.6f" $avg_weight)${NC}"
echo -e "   Total Evaluations: ${CYAN}$total_samples${NC}"
echo ""

# Show improvement over baseline
baseline_weight=$(echo "$templates" | jq -r '.[] | select(.id == "baseline") | .weight')
if [ "$baseline_weight" != "null" ] && [ -n "$baseline_weight" ]; then
    improvement=$(echo "scale=2; ($best_weight - $baseline_weight) / $baseline_weight * 100" | bc -l)
    echo -e "   ${GREEN}Best prompt is $(printf "%.1f" $improvement)% better than baseline${NC}"
fi
