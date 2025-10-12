#!/usr/bin/env bash

# Colors for output
GRAY='\033[0;90m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default values
VERBOSE=false
PAUSE_DURATION=0
ENVIRONMENT="dev"
BASE_URL=""

# Function to display help
show_help() {
    echo "Usage: ./test.sh [OPTIONS] [TEST_NAME] [ENVIRONMENT]"
    echo ""
    echo "Test the Prompt Reels API endpoints"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -v, --verbose           Show verbose output (curl commands and JSON responses in gray)"
    echo "  -p, --pause [SECONDS]   Pause after each test (default: 30s or until key press)"
    echo "                          Can specify custom duration: -p5 or --pause 10"
    echo ""
    echo "Environment:"
    echo "  dev                     Test against local dev server (default)"
    echo "                          http://localhost:PORT"
    echo "  prod                    Test against production server"
    echo "                          https://api.reels.hurated.com"
    echo ""
    echo "Test Names:"
    echo "  all                     Run all tests"
    echo "  health                  Test health check endpoint"
    echo "  upload                  Test video upload endpoint"
    echo "  analyze                 Test video analysis endpoint"
    echo "  prompts                 Test prompt management endpoints"
    echo "  fpo                     Test federated prompt optimization"
    echo ""
    echo "Examples:"
    echo "  ./test.sh all           Run all tests (dev)"
    echo "  ./test.sh all prod      Run all tests on production"
    echo "  ./test.sh -v health     Run health test with verbose output"
    echo "  ./test.sh -v health prod  Run health test on production with verbose"
    echo "  ./test.sh -pv all dev   Run all tests with pause (30s) and verbose on dev"
    echo "  ./test.sh -p5 upload    Run upload test, pause 5s after"
    echo "  ./test.sh prompts prod  Test prompts on production"
    echo ""
}

# Function to pause
do_pause() {
    if [ "$PAUSE_DURATION" -gt 0 ]; then
        echo -e "${YELLOW}Pausing for ${PAUSE_DURATION} seconds (press any key to continue)...${NC}"
        read -t "$PAUSE_DURATION" -n 1
        echo ""
    fi
}

# Function to make API call
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${GREEN}Testing: $description${NC}"
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${GRAY}curl -X $method $BASE_URL$endpoint${NC}"
        if [ ! -z "$data" ]; then
            echo -e "${GRAY}Data: $data${NC}"
        fi
    fi
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${GRAY}Response [$http_code]:${NC}"
        echo -e "${GRAY}$body${NC}" | jq '.' 2>/dev/null || echo -e "${GRAY}$body${NC}"
    fi
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ Success ($http_code)${NC}"
    else
        echo -e "${RED}✗ Failed ($http_code)${NC}"
        if [ "$VERBOSE" = false ]; then
            echo "$body"
        fi
    fi
    
    echo ""
}

# Function to upload file
upload_file() {
    local file_path=$1
    local description=$2
    
    echo -e "${GREEN}Testing: $description${NC}" >&2
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${GRAY}curl -X POST -F \"video=@$file_path\" $BASE_URL/api/upload${NC}" >&2
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/upload" \
        -F "video=@$file_path")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${GRAY}Response [$http_code]:${NC}" >&2
        echo -e "${GRAY}$body${NC}" | jq '.' 2>/dev/null || echo -e "${GRAY}$body${NC}" >&2
    fi
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ Success ($http_code)${NC}" >&2
        # Return only the video ID to stdout
        echo "$body" | jq -r '.videoId' 2>/dev/null
    else
        echo -e "${RED}✗ Failed ($http_code)${NC}" >&2
        if [ "$VERBOSE" = false ]; then
            echo "$body" >&2
        fi
    fi
    
    echo "" >&2
}

# Test functions
test_health() {
    api_call "GET" "/health" "" "Health check"
}

test_upload() {
    if [ -f "./test-videos/sample.mp4" ]; then
        LAST_VIDEO_ID=$(upload_file "./test-videos/sample.mp4" "Upload video")
        echo "Video ID: $LAST_VIDEO_ID"
    else
        echo -e "${YELLOW}Note: Upload test requires a video file in ./test-videos/${NC}"
        echo -e "${RED}No test video found at ./test-videos/sample.mp4${NC}"
        echo -e "${YELLOW}Please add a sample video file to continue.${NC}"
    fi
}

test_analyze() {
    if [ -z "$LAST_VIDEO_ID" ]; then
        echo -e "${YELLOW}Note: This test requires a valid VIDEO_ID from upload${NC}"
        echo -e "${YELLOW}Running test_upload first...${NC}"
        echo ""
        test_upload
        echo ""
    fi
    
    if [ -n "$LAST_VIDEO_ID" ]; then
        api_call "POST" "/api/analyze" "{\"videoId\":\"$LAST_VIDEO_ID\"}" "Analyze video"
    else
        echo -e "${RED}✗ No video ID available. Please run upload test first.${NC}"
    fi
}

test_prompts() {
    api_call "GET" "/api/prompts" "" "Get all prompts"
}

test_fpo() {
    api_call "POST" "/api/fpo/run" '{"iterations":3}' "Run FPO optimization"
    [ "$PAUSE_DURATION" -gt 0 ] && do_pause
    sleep 1  # Small delay for file writes to complete
    api_call "GET" "/api/fpo/status" "" "Get FPO status"
}

test_all() {
    test_health
    do_pause
    test_upload
    do_pause
    test_analyze
    do_pause
    test_prompts
    do_pause
    test_fpo
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -p*|-vp*)
            # Handle all pause flag combinations
            if [[ $1 =~ ^-p([0-9]+)?v?$ ]]; then
                # -p, -p5, -pv, -p5v
                if [[ $1 =~ v$ ]]; then
                    VERBOSE=true
                fi
                if [[ $1 =~ -p([0-9]+) ]]; then
                    PAUSE_DURATION="${BASH_REMATCH[1]}"
                else
                    PAUSE_DURATION=30
                fi
            elif [[ $1 =~ ^-vp([0-9]+)?$ ]]; then
                # -vp, -vp5
                VERBOSE=true
                if [[ $1 =~ -vp([0-9]+) ]]; then
                    PAUSE_DURATION="${BASH_REMATCH[1]}"
                else
                    PAUSE_DURATION=30
                fi
            fi
            shift
            ;;
        --pause)
            if [[ $2 =~ ^[0-9]+$ ]]; then
                PAUSE_DURATION=$2
                shift 2
            else
                PAUSE_DURATION=30
                shift
            fi
            ;;
        dev|prod)
            ENVIRONMENT=$1
            shift
            ;;
        all|health|upload|analyze|prompts|fpo)
            TEST_NAME=$1
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# If no test specified, show help
if [ -z "$TEST_NAME" ]; then
    show_help
    exit 0
fi

# Set BASE_URL based on environment
if [ "$ENVIRONMENT" = "prod" ]; then
    BASE_URL="https://api.reels.hurated.com"
else
    BASE_URL="http://localhost:${PORT:-15000}"
fi

# Run the requested test
echo -e "${YELLOW}=== Prompt Reels API Test Suite ===${NC}"
echo -e "${YELLOW}Environment: $ENVIRONMENT${NC}"
echo -e "${YELLOW}Base URL: $BASE_URL${NC}"
echo ""

case $TEST_NAME in
    all)
        test_all
        ;;
    health)
        test_health
        ;;
    upload)
        test_upload
        ;;
    analyze)
        test_analyze
        ;;
    prompts)
        test_prompts
        ;;
    fpo)
        test_fpo
        ;;
esac

echo -e "${GREEN}=== Tests Complete ===${NC}"
