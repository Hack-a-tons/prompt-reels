#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="prod"
SHOW_JSON=false
VIDEO_ID=""

# Function to display help
show_help() {
    echo "Usage: ./scripts/detected.sh [OPTIONS] [VIDEO_ID] [ENVIRONMENT]"
    echo ""
    echo "Show videos with scene detection completed"
    echo ""
    echo "Arguments:"
    echo "  VIDEO_ID                Show scenes for specific video"
    echo "  ENVIRONMENT             prod (default) or dev"
    echo ""
    echo "Options:"
    echo "  -j, --json              Show full JSON output"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/detected.sh                    # List all detected"
    echo "  ./scripts/detected.sh video-123          # Show scenes for video"
    echo "  ./scripts/detected.sh -j video-123       # Show full JSON"
    echo "  ./scripts/detected.sh dev                # List on dev server"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -j|--json)
            SHOW_JSON=true
            shift
            ;;
        prod|dev)
            ENVIRONMENT=$1
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            VIDEO_ID=$1
            shift
            ;;
    esac
done

echo -e "${YELLOW}=== Scene Detection Status ($ENVIRONMENT) ===${NC}"
echo ""

# Get scene files
if [ "$ENVIRONMENT" = "prod" ]; then
    SCENE_FILES=$(ssh reels.hurated.com "ls -1 prompt-reels/output/*_scenes.json 2>/dev/null" 2>/dev/null)
    
    if [ -z "$SCENE_FILES" ]; then
        echo -e "${BLUE}No scene detections found${NC}"
        exit 0
    fi
    
    # If specific video requested
    if [ -n "$VIDEO_ID" ]; then
        SCENE_FILE=$(ssh reels.hurated.com "ls prompt-reels/output/${VIDEO_ID}_scenes.json 2>/dev/null" 2>/dev/null)
        
        if [ -z "$SCENE_FILE" ]; then
            echo -e "${RED}No scenes found for: $VIDEO_ID${NC}"
            exit 1
        fi
        
        echo -e "${BLUE}Scenes for: $VIDEO_ID${NC}"
        echo ""
        
        # Get JSON
        JSON=$(ssh reels.hurated.com "cat prompt-reels/output/${VIDEO_ID}_scenes.json")
        
        if [ "$SHOW_JSON" = true ]; then
            echo "$JSON" | jq .
        else
            # Parse and display nicely
            scene_count=$(echo "$JSON" | jq -r '.sceneCount')
            threshold=$(echo "$JSON" | jq -r '.threshold')
            timestamp=$(echo "$JSON" | jq -r '.timestamp')
            
            echo -e "${GREEN}Scene Count: $scene_count${NC}"
            echo -e "Threshold: $threshold"
            echo -e "Detected: $timestamp"
            echo ""
            
            echo -e "${YELLOW}Scenes:${NC}"
            echo ""
            
            echo "$JSON" | jq -r '.scenes[] | 
                "Scene \(.sceneId):
   Time: \(.start)s - \(.end)s (duration: \(.duration)s)\(if .frames then "
   Frames: \(.frames | length)" else "" end)
"'
            
            # Check if frames exist
            has_frames=$(echo "$JSON" | jq -r '.scenes[0].frames // empty | length')
            if [ -n "$has_frames" ]; then
                echo ""
                echo -e "${GRAY}View scenes visually:${NC}"
                echo -e "${GRAY}https://api.reels.hurated.com/api/scenes/$VIDEO_ID${NC}"
            fi
        fi
    else
        # List all detected videos
        echo -e "${BLUE}Videos with scene detection:${NC}"
        echo ""
        
        counter=1
        echo "$SCENE_FILES" | while read -r file; do
            basename=$(basename "$file" _scenes.json)
            
            # Get scene count
            scene_count=$(ssh reels.hurated.com "cat $file" | jq -r '.sceneCount')
            timestamp=$(ssh reels.hurated.com "cat $file" | jq -r '.timestamp' | cut -d'T' -f1)
            
            echo -e "${GREEN}$counter. $basename${NC}"
            echo -e "   Scenes: $scene_count"
            echo -e "   Date: $timestamp"
            echo -e "   ${GRAY}./scripts/detected.sh $basename${NC}"
            echo ""
            
            counter=$((counter + 1))
        done
        
        total=$(echo "$SCENE_FILES" | wc -l | xargs)
        echo -e "${BLUE}Total: $total video(s) with scene detection${NC}"
    fi
else
    # Dev environment - local files
    if [ ! -d "output" ]; then
        echo -e "${BLUE}No output directory${NC}"
        exit 0
    fi
    
    SCENE_FILES=$(ls -1 output/*_scenes.json 2>/dev/null)
    
    if [ -z "$SCENE_FILES" ]; then
        echo -e "${BLUE}No scene detections found${NC}"
        exit 0
    fi
    
    if [ -n "$VIDEO_ID" ]; then
        if [ ! -f "output/${VIDEO_ID}_scenes.json" ]; then
            echo -e "${RED}No scenes found for: $VIDEO_ID${NC}"
            exit 1
        fi
        
        if [ "$SHOW_JSON" = true ]; then
            cat "output/${VIDEO_ID}_scenes.json" | jq .
        else
            JSON=$(cat "output/${VIDEO_ID}_scenes.json")
            
            scene_count=$(echo "$JSON" | jq -r '.sceneCount')
            threshold=$(echo "$JSON" | jq -r '.threshold')
            
            echo -e "${GREEN}Scene Count: $scene_count${NC}"
            echo -e "Threshold: $threshold"
            echo ""
            
            echo "$JSON" | jq -r '.scenes[] | 
                "Scene \(.sceneId): \(.start)s - \(.end)s (duration: \(.duration)s)"'
        fi
    else
        echo -e "${BLUE}Videos with scene detection:${NC}"
        echo ""
        
        counter=1
        echo "$SCENE_FILES" | while read -r file; do
            basename=$(basename "$file" _scenes.json)
            scene_count=$(cat "$file" | jq -r '.sceneCount')
            
            echo -e "${GREEN}$counter. $basename${NC}"
            echo -e "   Scenes: $scene_count"
            echo ""
            
            counter=$((counter + 1))
        done
    fi
fi
