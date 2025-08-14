#!/bin/bash

# CUI Instance Manager
# Manage all CUI project instances

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Base directories
CUI_BASE="/home/dev/workspace/cui"
INSTANCES_DIR="$HOME/.cui-instances"

# Function to list all instances
list_instances() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}       CUI Project Instances${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    
    if [ ! -d "$INSTANCES_DIR" ] || [ -z "$(ls -A "$INSTANCES_DIR" 2>/dev/null)" ]; then
        echo -e "${YELLOW}No instances configured${NC}"
        return
    fi
    
    for instance_dir in "$INSTANCES_DIR"/*; do
        if [ -d "$instance_dir" ]; then
            INSTANCE_NAME=$(basename "$instance_dir")
            CONFIG_FILE="$instance_dir/config.json"
            PID_FILE="$instance_dir/cui.pid"
            
            if [ -f "$CONFIG_FILE" ]; then
                PORT=$(grep -o '"port":[[:space:]]*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*$')
                PROJECT_ROOT=$(grep -o '"projectRoot":[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*: *"\(.*\)"/\1/')
                AUTH_TOKEN=$(grep -o '"authToken":[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*: *"\(.*\)"/\1/')
                
                STATUS="${RED}✗ Stopped${NC}"
                if [ -f "$PID_FILE" ]; then
                    PID=$(cat "$PID_FILE")
                    if ps -p "$PID" > /dev/null 2>&1; then
                        STATUS="${GREEN}✓ Running${NC} (PID: $PID)"
                    fi
                fi
                
                echo -e "\n${CYAN}Instance: ${NC}${INSTANCE_NAME}"
                echo -e "  ${YELLOW}Status:${NC}  $STATUS"
                echo -e "  ${YELLOW}Port:${NC}    $PORT"
                echo -e "  ${YELLOW}Token:${NC}   $AUTH_TOKEN"
                echo -e "  ${YELLOW}Project:${NC} $PROJECT_ROOT"
                echo -e "  ${YELLOW}URL:${NC}     ${BLUE}http://localhost:$PORT${NC}"
            fi
        fi
    done
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

# Function to start all instances
start_all() {
    echo -e "${YELLOW}Starting all CUI instances...${NC}"
    
    # Start oppie-thunder on 3001
    if [ -d "/home/dev/workspace/oppie-thunder" ]; then
        echo -e "${YELLOW}→ Starting oppie-thunder on port 3001${NC}"
        cd /home/dev/workspace/oppie-thunder
        "$CUI_BASE/setup-project-cui.sh" >/dev/null 2>&1
    fi
    
    # Start cui on 3002
    if [ -d "/home/dev/workspace/cui" ]; then
        echo -e "${YELLOW}→ Starting cui on port 3002${NC}"
        cd /home/dev/workspace/cui
        "$CUI_BASE/setup-project-cui.sh" >/dev/null 2>&1
    fi
    
    # Start oppie-growth-hacking on 3003
    if [ -d "/home/dev/workspace/oppie-growth-hacking" ]; then
        echo -e "${YELLOW}→ Starting oppie-growth-hacking on port 3003${NC}"
        cd /home/dev/workspace/oppie-growth-hacking
        "$CUI_BASE/setup-project-cui.sh" >/dev/null 2>&1
    fi
    
    echo -e "${GREEN}✓ All instances started${NC}"
}

# Function to stop all instances
stop_all() {
    echo -e "${YELLOW}Stopping all CUI instances...${NC}"
    
    if [ ! -d "$INSTANCES_DIR" ]; then
        echo -e "${YELLOW}No instances to stop${NC}"
        return
    fi
    
    for instance_dir in "$INSTANCES_DIR"/*; do
        if [ -d "$instance_dir" ]; then
            STOP_SCRIPT="$instance_dir/stop.sh"
            if [ -f "$STOP_SCRIPT" ]; then
                INSTANCE_NAME=$(basename "$instance_dir")
                echo -e "${YELLOW}→ Stopping $INSTANCE_NAME${NC}"
                "$STOP_SCRIPT" >/dev/null 2>&1
            fi
        fi
    done
    
    echo -e "${GREEN}✓ All instances stopped${NC}"
}

# Function to show URLs
show_urls() {
    PUBLIC_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}       CUI Instance Access Information${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    
    # Show info for each configured instance
    if [ -d "$INSTANCES_DIR" ]; then
        for instance_dir in "$INSTANCES_DIR"/*; do
            if [ -d "$instance_dir" ]; then
                INSTANCE_NAME=$(basename "$instance_dir")
                CONFIG_FILE="$instance_dir/config.json"
                
                if [ -f "$CONFIG_FILE" ]; then
                    PORT=$(grep -o '"port":[[:space:]]*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*$')
                    AUTH_TOKEN=$(grep -o '"authToken":[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*: *"\(.*\)"/\1/')
                    
                    echo -e "\n${CYAN}$INSTANCE_NAME:${NC}"
                    echo -e "  ${YELLOW}Port:${NC}    $PORT"
                    echo -e "  ${YELLOW}Token:${NC}   ${GREEN}$AUTH_TOKEN${NC}"
                    echo -e "  ${YELLOW}Local:${NC}   ${BLUE}http://localhost:$PORT${NC}"
                    echo -e "  ${YELLOW}Public:${NC}  ${BLUE}http://${PUBLIC_IP}:$PORT${NC}"
                fi
            fi
        done
    else
        echo -e "${YELLOW}No instances configured${NC}"
    fi
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

# Main menu
case "${1:-help}" in
    list|status)
        list_instances
        ;;
    start-all|start)
        start_all
        list_instances
        ;;
    stop-all|stop)
        stop_all
        ;;
    restart-all|restart)
        stop_all
        sleep 2
        start_all
        list_instances
        ;;
    urls)
        show_urls
        ;;
    help|*)
        echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}       CUI Instance Manager${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
        echo -e "\n${YELLOW}Usage:${NC} $0 [command]"
        echo -e "\n${YELLOW}Commands:${NC}"
        echo -e "  ${CYAN}list${NC}        Show all instances and their status"
        echo -e "  ${CYAN}start-all${NC}   Start all configured instances"
        echo -e "  ${CYAN}stop-all${NC}    Stop all running instances"
        echo -e "  ${CYAN}restart-all${NC} Restart all instances"
        echo -e "  ${CYAN}urls${NC}        Show all instance URLs"
        echo -e "  ${CYAN}help${NC}        Show this help message"
        echo -e "\n${YELLOW}Quick Setup:${NC}"
        echo -e "  1. Go to any project directory"
        echo -e "  2. Run: ${BLUE}$CUI_BASE/setup-project-cui.sh${NC}"
        echo -e "  3. Access at the assigned port"
        echo -e "\n${YELLOW}Pre-configured Projects:${NC}"
        echo -e "  • oppie-thunder       → Port 3001"
        echo -e "  • cui                 → Port 3002"
        echo -e "  • oppie-growth-hacking → Port 3003"
        echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
        ;;
esac