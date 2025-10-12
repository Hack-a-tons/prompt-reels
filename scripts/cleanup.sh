#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
CONFIRM=false
KEEP_DATA=false

# Function to display help
show_help() {
    echo "Usage: ./scripts/cleanup.sh [OPTIONS]"
    echo ""
    echo "Clean output and upload directories"
    echo ""
    echo "Options:"
    echo "  -y, --yes               Skip confirmation prompt"
    echo "  -k, --keep-data         Keep data/prompts.json (don't reset)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "What gets cleaned:"
    echo "  output/                 All output files and directories"
    echo "  uploads/                All uploaded video files"
    echo "  data/prompts.json       Reset to original state (unless --keep-data)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/cleanup.sh              # With confirmation"
    echo "  ./scripts/cleanup.sh -y           # No confirmation"
    echo "  ./scripts/cleanup.sh -y -k        # Clean but keep prompts data"
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
        -k|--keep-data)
            KEEP_DATA=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Show what will be cleaned
echo -e "${YELLOW}=== Cleanup ===${NC}"
echo ""
echo "The following will be removed:"
echo -e "  ${BLUE}✗ output/*${NC}     (all analysis results and logs)"
echo -e "  ${BLUE}✗ uploads/*${NC}    (all uploaded videos)"
if [ "$KEEP_DATA" = false ]; then
    echo -e "  ${BLUE}✗ data/prompts.json${NC}  (reset to original state)"
fi
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
echo -e "${YELLOW}Cleaning...${NC}"

# Clean output directory
if [ -d "output" ]; then
    file_count=$(find output -type f | wc -l | xargs)
    rm -rf output/*
    echo -e "${GREEN}✓ Cleaned output/ (removed $file_count files)${NC}"
else
    echo -e "${BLUE}ℹ output/ doesn't exist${NC}"
fi

# Clean uploads directory
if [ -d "uploads" ]; then
    file_count=$(find uploads -type f | wc -l | xargs)
    rm -rf uploads/*
    echo -e "${GREEN}✓ Cleaned uploads/ (removed $file_count files)${NC}"
else
    echo -e "${BLUE}ℹ uploads/ doesn't exist${NC}"
fi

# Reset prompts.json if not keeping data
if [ "$KEEP_DATA" = false ]; then
    if [ -f "data/prompts.json" ]; then
        npm run reset-prompts > /dev/null 2>&1
        echo -e "${GREEN}✓ Reset data/prompts.json to original state${NC}"
    else
        echo -e "${BLUE}ℹ data/prompts.json doesn't exist${NC}"
    fi
fi

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
