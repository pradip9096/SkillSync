#!/bin/bash

# ==========================================
# SkillSync Auto-Start Wrapper
# ==========================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SkillSync Project...${NC}"

# Check if ports are already in use to prevent ghost processes
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Backend (Port 5000) is already running."
else
    echo -e "${BLUE}Starting Backend...${NC}"
    (cd backend && npm start) &
    BACKEND_PID=$!
fi

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "Frontend (Port 5173) is already running."
else
    echo -e "${BLUE}Starting Frontend...${NC}"
    (cd frontend && npm run dev) &
    FRONTEND_PID=$!
fi

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
