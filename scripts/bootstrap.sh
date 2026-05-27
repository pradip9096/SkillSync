#!/bin/bash

# ==========================================
# SkillSync Dependency Bootstrapper
# ==========================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure we run relative to the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo -e "${BLUE}Bootstrapping SkillSync Project...${NC}"

echo -e "${BLUE}Installing backend dependencies...${NC}"
cd backend && npm install
cd ..

echo -e "${BLUE}Installing frontend dependencies...${NC}"
cd frontend && npm install
cd ..

echo -e "${GREEN}Project bootstrapped successfully!${NC}"
