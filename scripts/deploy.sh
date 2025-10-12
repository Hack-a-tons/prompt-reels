#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Default values
COMMIT_MESSAGE=""
SKIP_COMMIT=false
SKIP_BUILD=false
SHOW_LOGS=true
SERVER="reels.hurated.com"
PROJECT_DIR="prompt-reels"

# Function to display help
show_help() {
    echo "Usage: ./scripts/deploy.sh [OPTIONS]"
    echo ""
    echo "Deploy from dev to production server"
    echo ""
    echo "Options:"
    echo "  -m, --message MSG       Commit message (if changes exist)"
    echo "  -s, --skip-commit       Skip git commit (only push existing commits)"
    echo "  -b, --skip-build        Skip docker rebuild (just restart)"
    echo "  -n, --no-logs           Don't show logs after deploy"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Server:"
    echo "  Host: $SERVER"
    echo "  Directory: $PROJECT_DIR"
    echo ""
    echo "Deployment Steps:"
    echo "  1. Check git status"
    echo "  2. Commit changes (if -m provided and changes exist)"
    echo "  3. Push to GitHub"
    echo "  4. SSH to production server"
    echo "  5. Pull latest changes"
    echo "  6. Rebuild and restart Docker container"
    echo "  7. Show logs (optional)"
    echo ""
    echo "Examples:"
    echo "  # Quick deploy (auto-commit if changes)"
    echo "  ./scripts/deploy.sh -m \"Fix scene detection\""
    echo ""
    echo "  # Deploy without committing (push existing commits)"
    echo "  ./scripts/deploy.sh -s"
    echo ""
    echo "  # Deploy and restart without rebuilding"
    echo "  ./scripts/deploy.sh -b"
    echo ""
    echo "  # Deploy without showing logs"
    echo "  ./scripts/deploy.sh -m \"Update\" -n"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -m|--message)
            COMMIT_MESSAGE="$2"
            shift 2
            ;;
        -s|--skip-commit)
            SKIP_COMMIT=true
            shift
            ;;
        -b|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -n|--no-logs)
            SHOW_LOGS=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}=== Deploy to Production ===${NC}"
echo -e "${BLUE}Server: $SERVER${NC}"
echo ""

# Step 1: Check git status
echo -e "${YELLOW}[1/7] Checking git status...${NC}"
if ! git status &>/dev/null; then
    echo -e "${RED}✗ Not a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    HAS_CHANGES=true
    echo -e "${BLUE}ℹ Uncommitted changes detected${NC}"
    
    if [ "$SKIP_COMMIT" = false ] && [ -n "$COMMIT_MESSAGE" ]; then
        # Step 2: Commit changes
        echo ""
        echo -e "${YELLOW}[2/7] Committing changes...${NC}"
        git add -A
        git commit -m "$COMMIT_MESSAGE"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Changes committed${NC}"
        else
            echo -e "${RED}✗ Commit failed${NC}"
            exit 1
        fi
    elif [ "$SKIP_COMMIT" = false ]; then
        echo -e "${RED}✗ Uncommitted changes exist. Use -m to commit or -s to skip${NC}"
        exit 1
    else
        echo -e "${BLUE}ℹ Skipping commit (uncommitted changes will not be deployed)${NC}"
    fi
else
    echo -e "${GREEN}✓ Working directory clean${NC}"
fi

# Step 3: Push to GitHub
echo ""
echo -e "${YELLOW}[3/7] Pushing to GitHub...${NC}"
git push
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Pushed to GitHub${NC}"
else
    echo -e "${RED}✗ Push failed${NC}"
    exit 1
fi

# Step 4: SSH to production and pull
echo ""
echo -e "${YELLOW}[4/7] Connecting to $SERVER...${NC}"
echo -e "${GRAY}ssh $SERVER \"cd $PROJECT_DIR && git pull\"${NC}"

PULL_OUTPUT=$(ssh $SERVER "cd $PROJECT_DIR && git pull" 2>&1)
PULL_EXIT=$?

if [ $PULL_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Pulled latest changes${NC}"
    
    # Check if any files were updated
    if echo "$PULL_OUTPUT" | grep -q "Already up to date"; then
        echo -e "${BLUE}ℹ No new changes on server${NC}"
    else
        echo -e "${GRAY}${PULL_OUTPUT}${NC}"
    fi
else
    echo -e "${RED}✗ Git pull failed${NC}"
    echo "$PULL_OUTPUT"
    exit 1
fi

# Step 5 & 6: Rebuild and restart Docker
echo ""
if [ "$SKIP_BUILD" = true ]; then
    echo -e "${YELLOW}[5/7] Restarting container (no rebuild)...${NC}"
    echo -e "${GRAY}ssh $SERVER \"cd $PROJECT_DIR && docker compose restart\"${NC}"
    
    RESTART_OUTPUT=$(ssh $SERVER "cd $PROJECT_DIR && docker compose restart" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Container restarted${NC}"
    else
        echo -e "${RED}✗ Restart failed${NC}"
        echo "$RESTART_OUTPUT"
        exit 1
    fi
else
    echo -e "${YELLOW}[5/7] Rebuilding and restarting container...${NC}"
    echo -e "${GRAY}ssh $SERVER \"cd $PROJECT_DIR && docker compose up -d --build\"${NC}"
    
    BUILD_OUTPUT=$(ssh $SERVER "cd $PROJECT_DIR && docker compose up -d --build" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Container rebuilt and restarted${NC}"
    else
        echo -e "${RED}✗ Build failed${NC}"
        echo "$BUILD_OUTPUT"
        exit 1
    fi
fi

# Step 7: Show logs
if [ "$SHOW_LOGS" = true ]; then
    echo ""
    echo -e "${YELLOW}[6/7] Waiting for startup...${NC}"
    sleep 3
    
    echo ""
    echo -e "${YELLOW}[7/7] Container logs (last 20 lines):${NC}"
    echo -e "${GRAY}────────────────────────────────────────${NC}"
    
    ssh $SERVER "cd $PROJECT_DIR && docker compose logs --tail=20"
    
    echo -e "${GRAY}────────────────────────────────────────${NC}"
else
    echo -e "${BLUE}ℹ Skipping logs${NC}"
fi

# Health check
echo ""
echo -e "${YELLOW}Checking health...${NC}"
HEALTH_CHECK=$(curl -s https://api.reels.hurated.com/health 2>&1)

if [ $? -eq 0 ]; then
    STATUS=$(echo "$HEALTH_CHECK" | jq -r '.status' 2>/dev/null)
    if [ "$STATUS" = "ok" ] || [ "$STATUS" = "healthy" ]; then
        echo -e "${GREEN}✓ API is healthy!${NC}"
        echo ""
        echo -e "${GREEN}✓ Deployment complete!${NC}"
        echo ""
        echo -e "${BLUE}API:${NC} https://api.reels.hurated.com"
        echo -e "${BLUE}Health:${NC} https://api.reels.hurated.com/health"
    else
        echo -e "${RED}✗ API returned unexpected status${NC}"
        echo "$HEALTH_CHECK"
    fi
else
    echo -e "${RED}✗ Could not reach API${NC}"
    echo "Check logs with: ssh $SERVER 'cd $PROJECT_DIR && docker compose logs'"
fi

echo ""
