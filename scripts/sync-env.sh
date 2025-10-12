#!/usr/bin/env bash

# Script to sync .env with .env.example structure
# Preserves your actual values while updating comments and removing unused keys

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== Syncing .env with .env.example structure ===${NC}"
echo ""

if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Backup current .env
cp .env .env.backup
echo -e "${GREEN}✓ Backed up .env to .env.backup${NC}"

# Extract values from current .env
PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
NODE_ENV=$(grep "^NODE_ENV=" .env | cut -d'=' -f2)
GOOGLE_API_KEY=$(grep "^GOOGLE_API_KEY=" .env | cut -d'=' -f2)
GEMINI_MODEL=$(grep "^GEMINI_MODEL=" .env | cut -d'=' -f2)
WANDB_API_KEY=$(grep "^WANDB_API_KEY=" .env | cut -d'=' -f2)
WANDB_PROJECT=$(grep "^WANDB_PROJECT=" .env | cut -d'=' -f2)
AZURE_OPENAI_API_KEY=$(grep "^AZURE_OPENAI_API_KEY=" .env | cut -d'=' -f2)
AZURE_OPENAI_ENDPOINT=$(grep "^AZURE_OPENAI_ENDPOINT=" .env | cut -d'=' -f2)
AZURE_API_VERSION=$(grep "^AZURE_API_VERSION=" .env | cut -d'=' -f2)
AZURE_DEPLOYMENT_NAME=$(grep "^AZURE_DEPLOYMENT_NAME=" .env | cut -d'=' -f2)
UPLOAD_DIR=$(grep "^UPLOAD_DIR=" .env | cut -d'=' -f2)
OUTPUT_DIR=$(grep "^OUTPUT_DIR=" .env | cut -d'=' -f2)
DATA_DIR=$(grep "^DATA_DIR=" .env | cut -d'=' -f2)
TAVILY_API_KEY=$(grep "^TAVILY_API_KEY=" .env | cut -d'=' -f2)
BROWSERBASE_API_KEY=$(grep "^BROWSERBASE_API_KEY=" .env | cut -d'=' -f2)
BROWSERBASE_PROJECT_ID=$(grep "^BROWSERBASE_PROJECT_ID=" .env | cut -d'=' -f2)

# Check for AI_PROVIDER (may not exist)
AI_PROVIDER=$(grep "^AI_PROVIDER=" .env | cut -d'=' -f2 || echo "azure")

echo -e "${BLUE}Extracted values from current .env${NC}"

# Create new .env with correct structure
cat > .env << EOF
# Server Configuration
PORT=${PORT}
NODE_ENV=${NODE_ENV}

# AI Provider: 'azure' or 'gemini'
# Switch between providers as needed, system will remember last successful provider
AI_PROVIDER=${AI_PROVIDER}

# Google Gemini API
GOOGLE_API_KEY=${GOOGLE_API_KEY}
GEMINI_MODEL=${GEMINI_MODEL}

# Weights & Biases (Weave)
WANDB_API_KEY=${WANDB_API_KEY}
WANDB_PROJECT=${WANDB_PROJECT}

# Azure OpenAI
AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY}
AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}
AZURE_API_VERSION=${AZURE_API_VERSION}
AZURE_DEPLOYMENT_NAME=${AZURE_DEPLOYMENT_NAME}

# Directories
UPLOAD_DIR=${UPLOAD_DIR}
OUTPUT_DIR=${OUTPUT_DIR}
DATA_DIR=${DATA_DIR}

# News Fetching (Required for /api/fetch-news)
TAVILY_API_KEY=${TAVILY_API_KEY}
BROWSERBASE_API_KEY=${BROWSERBASE_API_KEY}
BROWSERBASE_PROJECT_ID=${BROWSERBASE_PROJECT_ID}
EOF

echo -e "${GREEN}✓ Created new .env with correct structure${NC}"
echo ""
echo -e "${YELLOW}Removed unused keys:${NC}"
echo -e "  ${RED}✗ DOMAIN${NC} (not used in code)"
echo -e "  ${RED}✗ MAX_FILE_SIZE${NC} (hardcoded to 200MB)"
echo -e "  ${RED}✗ FRAMES_PER_SCENE${NC} (not used in new scene detection)"
echo -e "  ${RED}✗ SCENE_DURATION_SECONDS${NC} (not used in new scene detection)"
echo ""
echo -e "${GREEN}✓ .env now matches .env.example structure!${NC}"
echo -e "${BLUE}Backup saved at: .env.backup${NC}"
