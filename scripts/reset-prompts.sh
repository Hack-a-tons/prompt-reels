#!/usr/bin/env bash

# Reset prompts.json to clean template state
# Useful before committing or when you want to start fresh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Resetting prompts.json to clean template...${NC}"

if [ ! -f data/prompts.template.json ]; then
  echo "Error: data/prompts.template.json not found"
  exit 1
fi

cp data/prompts.template.json data/prompts.json

echo -e "${GREEN}✓ prompts.json reset to clean state${NC}"
echo -e "${GREEN}✓ All performance history cleared${NC}"
