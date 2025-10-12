#!/usr/bin/env bash

# Prompt Reels Runner
# This script can be run from anywhere and will:
# 1. Change to the project directory
# 2. Free up the port if needed
# 3. Start the development server

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${YELLOW}📂 Changing to project directory: ${SCRIPT_DIR}${NC}"
cd "${SCRIPT_DIR}"

echo -e "${YELLOW}🔓 Freeing port...${NC}"
./scripts/free-port.sh

echo -e "${GREEN}🚀 Starting development server...${NC}"
npm run dev
