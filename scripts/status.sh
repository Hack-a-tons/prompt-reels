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
WATCH_MODE=false

# Function to display help
show_help() {
    echo "Usage: ./scripts/status.sh [OPTIONS] [ENVIRONMENT]"
    echo ""
    echo "Show action status (flags) and queue state"
    echo ""
    echo "Options:"
    echo "  -w, --watch             Watch mode (refresh every 3s)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment:"
    echo "  prod                    Production server (default)"
    echo "  dev                     Local dev server"
    echo ""
    echo "Examples:"
    echo "  ./scripts/status.sh                   # Show status on prod"
    echo "  ./scripts/status.sh dev               # Show status on dev"
    echo "  ./scripts/status.sh --watch           # Watch mode"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -w|--watch)
            WATCH_MODE=true
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

# Function to show status
show_status() {
    clear
    
    echo -e "${YELLOW}=== Prompt Reels Status ($ENVIRONMENT) ===${NC}"
    echo -e "${GRAY}$(date)${NC}"
    echo ""
    
    # Set BASE_URL based on environment
    if [ "$ENVIRONMENT" = "prod" ]; then
        BASE_URL="https://api.reels.hurated.com"
    else
        BASE_URL="http://localhost:${PORT:-15000}"
    fi
    
    # Get flags status
    echo -e "${BLUE}🚩 Active Flags (Temporary)${NC}"
    echo -e "${GRAY}Flags are cleared on Docker restart${NC}"
    echo ""
    
    flags_response=$(curl -s "$BASE_URL/api/flags/status" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$flags_response" ]; then
        batch_adding=$(echo "$flags_response" | jq -r '.batchAdding')
        fpo_running=$(echo "$flags_response" | jq -r '.fpoRunning')
        
        active_flags=0
        
        if [ "$batch_adding" = "true" ]; then
            batch_data=$(echo "$flags_response" | jq -r '.batchAddingData')
            target=$(echo "$batch_data" | jq -r '.targetCount // "?"')
            started=$(echo "$batch_data" | jq -r '.startedAt // "unknown"')
            echo -e "   ${YELLOW}⏳ Batch Adding${NC}: Adding $target articles"
            echo -e "      Started: $started"
            active_flags=$((active_flags + 1))
        fi
        
        if [ "$fpo_running" = "true" ]; then
            fpo_data=$(echo "$flags_response" | jq -r '.fpoRunningData')
            iterations=$(echo "$fpo_data" | jq -r '.iterations // "?"')
            started=$(echo "$fpo_data" | jq -r '.startedAt // "unknown"')
            echo -e "   ${PURPLE}🧠 FPO Running${NC}: $iterations iterations"
            echo -e "      Started: $started"
            active_flags=$((active_flags + 1))
        fi
        
        if [ $active_flags -eq 0 ]; then
            echo -e "   ${GREEN}✓ No active flags${NC}"
        fi
    else
        echo -e "   ${RED}✗ Cannot connect to API${NC}"
    fi
    
    echo ""
    
    # Get queue status
    echo -e "${BLUE}📋 Processing Queues (Persistent)${NC}"
    echo -e "${GRAY}Queues survive Docker restart${NC}"
    echo ""
    
    queue_response=$(curl -s "$BASE_URL/api/queue/status" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$queue_response" ]; then
        # Fetch queue
        fetch_processing=$(echo "$queue_response" | jq -r '.fetch.processing')
        fetch_queued=$(echo "$queue_response" | jq -r '.fetch.queued')
        
        echo -e "   ${PURPLE}📥 Fetch Queue${NC}"
        if [ "$fetch_processing" != "null" ]; then
            item_id=$(echo "$fetch_processing" | jq -r '.id // .articleId // "unknown"')
            started=$(echo "$fetch_processing" | jq -r '.startedAt // "unknown"')
            echo -e "      ${YELLOW}▶ Processing${NC}: $item_id"
            echo -e "         Started: $(echo $started | cut -c12-19)"
        else
            echo -e "      ${GRAY}○ Idle${NC}"
        fi
        echo -e "      Queued: $fetch_queued"
        echo ""
        
        # Describe queue
        describe_processing=$(echo "$queue_response" | jq -r '.describe.processing')
        describe_queued=$(echo "$queue_response" | jq -r '.describe.queued')
        
        echo -e "   ${PURPLE}🎬 Describe Queue${NC}"
        if [ "$describe_processing" != "null" ]; then
            item_id=$(echo "$describe_processing" | jq -r '.articleId // "unknown"')
            started=$(echo "$describe_processing" | jq -r '.startedAt // "unknown"')
            echo -e "      ${YELLOW}▶ Processing${NC}: $item_id"
            echo -e "         Started: $(echo $started | cut -c12-19)"
        else
            echo -e "      ${GRAY}○ Idle${NC}"
        fi
        echo -e "      Queued: $describe_queued"
        echo ""
        
        # Rate queue
        rate_processing=$(echo "$queue_response" | jq -r '.rate.processing')
        rate_queued=$(echo "$queue_response" | jq -r '.rate.queued')
        
        echo -e "   ${PURPLE}⭐ Rate Queue${NC}"
        if [ "$rate_processing" != "null" ]; then
            item_id=$(echo "$rate_processing" | jq -r '.articleId // "unknown"')
            started=$(echo "$rate_processing" | jq -r '.startedAt // "unknown"')
            echo -e "      ${YELLOW}▶ Processing${NC}: $item_id"
            echo -e "         Started: $(echo $started | cut -c12-19)"
        else
            echo -e "      ${GRAY}○ Idle${NC}"
        fi
        echo -e "      Queued: $rate_queued"
        echo ""
        
        # FPO queue
        fpo_processing=$(echo "$queue_response" | jq -r '.fpo.processing')
        fpo_queued=$(echo "$queue_response" | jq -r '.fpo.queued')
        
        echo -e "   ${PURPLE}🧠 FPO Queue${NC}"
        if [ "$fpo_processing" != "null" ]; then
            started=$(echo "$fpo_processing" | jq -r '.startedAt // "unknown"')
            echo -e "      ${YELLOW}▶ Processing${NC}"
            echo -e "         Started: $(echo $started | cut -c12-19)"
        else
            echo -e "      ${GRAY}○ Idle${NC}"
        fi
        echo -e "      Queued: $fpo_queued"
        echo ""
    else
        echo -e "   ${RED}✗ Cannot connect to API${NC}"
        echo ""
    fi
    
    # Show concurrent processing summary
    echo -e "${BLUE}⚡ Concurrent Processing${NC}"
    echo -e "${GRAY}Up to 4 actions can run simultaneously (1 of each type)${NC}"
    echo ""
    
    active_count=0
    if [ "$fetch_processing" != "null" ]; then
        echo -e "   ${GREEN}✓${NC} Fetch: Active"
        active_count=$((active_count + 1))
    else
        echo -e "   ${GRAY}○${NC} Fetch: Idle"
    fi
    
    if [ "$describe_processing" != "null" ]; then
        echo -e "   ${GREEN}✓${NC} Describe: Active"
        active_count=$((active_count + 1))
    else
        echo -e "   ${GRAY}○${NC} Describe: Idle"
    fi
    
    if [ "$rate_processing" != "null" ]; then
        echo -e "   ${GREEN}✓${NC} Rate: Active"
        active_count=$((active_count + 1))
    else
        echo -e "   ${GRAY}○${NC} Rate: Idle"
    fi
    
    if [ "$fpo_processing" != "null" ]; then
        echo -e "   ${GREEN}✓${NC} FPO: Active"
        active_count=$((active_count + 1))
    else
        echo -e "   ${GRAY}○${NC} FPO: Idle"
    fi
    
    echo ""
    echo -e "   Active: ${GREEN}$active_count/4${NC}"
    echo ""
    
    if [ "$WATCH_MODE" = true ]; then
        echo -e "${GRAY}Refreshing every 3s... (Ctrl+C to exit)${NC}"
    fi
}

# Main loop
if [ "$WATCH_MODE" = true ]; then
    while true; do
        show_status
        sleep 3
    done
else
    show_status
fi
