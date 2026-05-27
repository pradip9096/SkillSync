#!/bin/bash

# ==========================================
# SkillSync Port Clearing Utility
# ==========================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

clear_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -t -i:$port -sTCP:LISTEN)
    if [ ! -z "$pid" ]; then
        echo -e "${BLUE}Port $port ($name) is currently in use by PID $pid. Terminating process...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
    else
        echo -e "${GREEN}Port $port ($name) is free.${NC}"
    fi
}

clear_port 5000 "Backend"
clear_port 5173 "Frontend"
