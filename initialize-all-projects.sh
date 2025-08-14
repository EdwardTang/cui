#!/bin/bash

# One-click initialization for all three projects
# This script sets up dedicated CUI instances for each project

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       Initializing All Project CUI Instances${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Get public IP
PUBLIC_IP=$(hostname -I | awk '{print $1}')

# Project configurations
declare -A PROJECTS
PROJECTS["/home/dev/workspace/oppie-thunder"]=3001
PROJECTS["/home/dev/workspace/cui"]=3002
PROJECTS["/home/dev/workspace/oppie-growth-hacking"]=3003

# Stop any existing instances first
echo -e "${YELLOW}→ Stopping any existing CUI instances...${NC}"
pkill -f "node.*cui.*server.js" 2>/dev/null || true
sleep 2

# Setup each project
for PROJECT_PATH in "${!PROJECTS[@]}"; do
    PORT=${PROJECTS[$PROJECT_PATH]}
    PROJECT_NAME=$(basename "$PROJECT_PATH")
    
    echo -e "\n${CYAN}Setting up $PROJECT_NAME on port $PORT...${NC}"
    
    # Check if project directory exists
    if [ ! -d "$PROJECT_PATH" ]; then
        echo -e "${YELLOW}  Creating project directory: $PROJECT_PATH${NC}"
        mkdir -p "$PROJECT_PATH"
    fi
    
    # Run setup script for this project
    cd "$PROJECT_PATH"
    /home/dev/workspace/cui/setup-project-cui.sh 2>&1 | grep -E "✓|✗|Port:|URL:" || true
    
    echo -e "${GREEN}✓ $PROJECT_NAME configured on port $PORT${NC}"
done

# Display summary
echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}       All CUI Instances Ready!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}\n"

echo -e "${CYAN}oppie-thunder (Port 3001):${NC}"
echo -e "  ${BLUE}http://localhost:3001${NC}"
echo -e "  ${BLUE}http://${PUBLIC_IP}:3001${NC}\n"

echo -e "${CYAN}cui (Port 3002):${NC}"
echo -e "  ${BLUE}http://localhost:3002${NC}"
echo -e "  ${BLUE}http://${PUBLIC_IP}:3002${NC}\n"

echo -e "${CYAN}oppie-growth-hacking (Port 3003):${NC}"
echo -e "  ${BLUE}http://localhost:3003${NC}"
echo -e "  ${BLUE}http://${PUBLIC_IP}:3003${NC}\n"

echo -e "${YELLOW}Management Commands:${NC}"
echo -e "  View all instances:  ${BLUE}/home/dev/workspace/cui/cui-manager.sh list${NC}"
echo -e "  Stop all instances:  ${BLUE}/home/dev/workspace/cui/cui-manager.sh stop-all${NC}"
echo -e "  Start all instances: ${BLUE}/home/dev/workspace/cui/cui-manager.sh start-all${NC}"

echo -e "\n${YELLOW}Individual Project Commands:${NC}"
echo -e "  Each project now has: ${BLUE}./cui-start.sh${NC} in its root directory"

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}\n"