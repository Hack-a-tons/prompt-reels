#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Default values
CONFIRM=false
TARGET=""

# Function to display help
show_help() {
    echo "Usage: ./scripts/cleanup.sh [TARGET] [OPTIONS]"
    echo ""
    echo "Clean specific directories or everything"
    echo ""
    echo "Targets:"
    echo "  all                     Clean everything (output + uploads + articles + prompts)"
    echo "  articles                Clean fetched articles and their videos"
    echo "  output                  Clean output directory (analysis results, logs)"
    echo "  uploads                 Clean uploaded videos"
    echo "  prompts                 Reset data/prompts.json to original state"
    echo ""
    echo "Options:"
    echo "  -y, --yes               Skip confirmation prompt"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/cleanup.sh                    # Show help"
    echo "  ./scripts/cleanup.sh all                # Clean everything (with confirmation)"
    echo "  ./scripts/cleanup.sh all -y             # Clean everything (no confirmation)"
    echo "  ./scripts/cleanup.sh articles           # Clean only articles"
    echo "  ./scripts/cleanup.sh output             # Clean only output"
    echo "  ./scripts/cleanup.sh uploads            # Clean only uploads"
    echo "  ./scripts/cleanup.sh prompts            # Reset prompts only"
    echo ""
    echo "What's in each target:"
    echo -e "  ${GRAY}articles:${NC}  output/articles/, uploads/articles/"
    echo -e "  ${GRAY}output:${NC}    output/* (except articles/)"
    echo -e "  ${GRAY}uploads:${NC}   uploads/* (except articles/)"
    echo -e "  ${GRAY}prompts:${NC}   data/prompts.json → reset to defaults"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -y|--yes)
            CONFIRM=true
            shift
            ;;
        all|articles|output|uploads|prompts)
            TARGET=$1
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
done

# If no target specified, show help
if [ -z "$TARGET" ]; then
    show_help
    exit 0
fi

# Functions to clean each target
clean_articles() {
    echo -e "${YELLOW}Cleaning articles...${NC}"
    local count=0
    
    # Clean output/articles/
    if [ -d "output/articles" ]; then
        local files=$(find output/articles -type f | wc -l | xargs)
        rm -rf output/articles/*
        count=$((count + files))
        echo -e "${GREEN}✓ Cleaned output/articles/ (removed $files files)${NC}"
    fi
    
    # Clean uploads/articles/
    if [ -d "uploads/articles" ]; then
        local files=$(find uploads/articles -type f | wc -l | xargs)
        rm -rf uploads/articles/*
        count=$((count + files))
        echo -e "${GREEN}✓ Cleaned uploads/articles/ (removed $files files)${NC}"
    fi
    
    if [ $count -eq 0 ]; then
        echo -e "${BLUE}ℹ No articles to clean${NC}"
    fi
}

clean_output() {
    echo -e "${YELLOW}Cleaning output...${NC}"
    
    if [ -d "output" ]; then
        # Exclude articles directory
        local file_count=0
        for item in output/*; do
            if [ "$(basename "$item")" != "articles" ]; then
                if [ -e "$item" ]; then
                    rm -rf "$item"
                    file_count=$((file_count + 1))
                fi
            fi
        done
        
        if [ $file_count -gt 0 ]; then
            echo -e "${GREEN}✓ Cleaned output/ (removed $file_count items)${NC}"
        else
            echo -e "${BLUE}ℹ No output files to clean${NC}"
        fi
    else
        echo -e "${BLUE}ℹ output/ doesn't exist${NC}"
    fi
}

clean_uploads() {
    echo -e "${YELLOW}Cleaning uploads...${NC}"
    
    if [ -d "uploads" ]; then
        # Exclude articles directory
        local file_count=0
        for item in uploads/*; do
            if [ "$(basename "$item")" != "articles" ]; then
                if [ -e "$item" ]; then
                    rm -rf "$item"
                    file_count=$((file_count + 1))
                fi
            fi
        done
        
        if [ $file_count -gt 0 ]; then
            echo -e "${GREEN}✓ Cleaned uploads/ (removed $file_count items)${NC}"
        else
            echo -e "${BLUE}ℹ No uploaded files to clean${NC}"
        fi
    else
        echo -e "${BLUE}ℹ uploads/ doesn't exist${NC}"
    fi
}

clean_prompts() {
    echo -e "${YELLOW}Resetting prompts...${NC}"
    
    if [ -f "data/prompts.json" ]; then
        npm run reset-prompts > /dev/null 2>&1
        echo -e "${GREEN}✓ Reset data/prompts.json to original state${NC}"
    else
        echo -e "${BLUE}ℹ data/prompts.json doesn't exist${NC}"
    fi
}

# Show what will be cleaned
echo -e "${YELLOW}=== Cleanup: $TARGET ===${NC}"
echo ""

case $TARGET in
    all)
        echo "Will clean:"
        echo -e "  ${BLUE}✗ output/* (except articles)${NC}"
        echo -e "  ${BLUE}✗ uploads/* (except articles)${NC}"
        echo -e "  ${BLUE}✗ output/articles/*, uploads/articles/*${NC}"
        echo -e "  ${BLUE}✗ data/prompts.json (reset)${NC}"
        ;;
    articles)
        echo "Will clean:"
        echo -e "  ${BLUE}✗ output/articles/*${NC}"
        echo -e "  ${BLUE}✗ uploads/articles/*${NC}"
        ;;
    output)
        echo "Will clean:"
        echo -e "  ${BLUE}✗ output/* (except articles/)${NC}"
        ;;
    uploads)
        echo "Will clean:"
        echo -e "  ${BLUE}✗ uploads/* (except articles/)${NC}"
        ;;
    prompts)
        echo "Will reset:"
        echo -e "  ${BLUE}✗ data/prompts.json${NC}"
        ;;
esac

echo ""

# Confirm unless -y flag
if [ "$CONFIRM" = false ]; then
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""

# Execute cleanup based on target
case $TARGET in
    all)
        clean_output
        clean_uploads
        clean_articles
        clean_prompts
        ;;
    articles)
        clean_articles
        ;;
    output)
        clean_output
        ;;
    uploads)
        clean_uploads
        ;;
    prompts)
        clean_prompts
        ;;
esac

echo ""
echo -e "${GREEN}✓ Cleanup complete!${NC}"
echo ""

# Show directory sizes
if command -v du &> /dev/null; then
    echo "Directory sizes:"
    if [ -d "output" ]; then
        output_size=$(du -sh output 2>/dev/null | cut -f1)
        echo "  output:  $output_size"
    fi
    if [ -d "uploads" ]; then
        uploads_size=$(du -sh uploads 2>/dev/null | cut -f1)
        echo "  uploads: $uploads_size"
    fi
fi
