#!/bin/bash

# ==========================================
# SkillSync Database Seeding Utility
# ==========================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure we run relative to the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo -e "${BLUE}Starting database seeding...${NC}"

if [ ! -f backend/.env ]; then
    echo -e "\033[0;31mError: backend/.env file not found. Seeding requires MONGO_URI to be configured.\033[0m"
    exit 1
fi

cd backend

echo -e "${BLUE}1. Running User Seeder...${NC}"
node src/seeds/userSeeder.js

echo -e "${BLUE}2. Running Expert Seeder...${NC}"
node src/seeds/expertSeeder.js

echo -e "${BLUE}3. Running Slot Migration...${NC}"
node src/seeds/migrateBlockedSlots.js

echo -e "${GREEN}Database seeding completed successfully!${NC}"
