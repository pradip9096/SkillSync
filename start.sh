#!/bin/bash

# ==========================================
# SkillSync Auto-Start Wrapper
# ==========================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SkillSync Project...${NC}"

# Proactively terminate ghost processes on the required ports to ensure clean startup
clear_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -t -i:$port -sTCP:LISTEN)
    if [ ! -z "$pid" ]; then
        echo -e "Port $port ($name) is currently in use by PID $pid. Terminating ghost process to ensure fresh startup..."
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

clear_port 5000 "Backend"
clear_port 5173 "Frontend"

echo -e "${BLUE}Starting Backend...${NC}"
(cd backend && npm run dev) &
BACKEND_PID=$!

echo -e "${BLUE}Starting Frontend...${NC}"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

# If neither were started by this script, exit gracefully
if [ -z "$BACKEND_PID" ] && [ -z "$FRONTEND_PID" ]; then
    echo -e "${GREEN}All services are already running!${NC}"
    exit 0
fi

echo -e "${GREEN}Project is running. Press Ctrl+C to stop both servers.${NC}"

# Clean up background processes when the user exits (Ctrl+C)
trap 'echo "Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' EXIT

# Wait for background processes to finish
wait
