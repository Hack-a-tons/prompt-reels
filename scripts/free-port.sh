#!/usr/bin/env bash

# Free port script for Prompt Reels
# Kills any processes using the PORT defined in .env

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get PORT from .env file
if [ -f .env ]; then
  PORT=$(grep '^PORT=' .env | cut -d '=' -f2)
else
  echo -e "${YELLOW}Warning: .env file not found, using default port 15000${NC}"
  PORT=15000
fi

echo -e "${YELLOW}Checking for processes using port ${PORT}...${NC}"

# Check if lsof command exists
if ! command -v lsof &> /dev/null; then
  echo -e "${RED}Error: lsof command not found${NC}"
  exit 1
fi

# Find processes using the port
PIDS=$(lsof -ti:${PORT} 2>/dev/null || true)

if [ -z "$PIDS" ]; then
  echo -e "${GREEN}✓ Port ${PORT} is free${NC}"
  exit 0
fi

# Count processes
COUNT=$(echo "$PIDS" | wc -l | xargs)

echo -e "${YELLOW}Found ${COUNT} process(es) using port ${PORT}:${NC}"

# Show process details
lsof -i:${PORT} | grep -v "^COMMAND" || true

echo ""
echo -e "${YELLOW}Killing process(es)...${NC}"

# Kill processes
for PID in $PIDS; do
  echo -e "Killing PID ${PID}..."
  kill -9 $PID 2>/dev/null || echo -e "${RED}Failed to kill PID ${PID}${NC}"
done

# Wait a moment
sleep 1

# Verify port is free
REMAINING=$(lsof -ti:${PORT} 2>/dev/null || true)

if [ -z "$REMAINING" ]; then
  echo -e "${GREEN}✓ Port ${PORT} is now free${NC}"
  exit 0
else
  echo -e "${RED}✗ Some processes may still be using port ${PORT}${NC}"
  exit 1
fi
