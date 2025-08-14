#!/bin/bash

# CUI Project Instance Setup Script
# Automatically sets up a dedicated CUI instance for the current project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root (where script is run from)
PROJECT_ROOT="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

# CUI base directory
CUI_BASE="/home/dev/workspace/cui"

# Port assignment based on project path
assign_port() {
    case "$PROJECT_ROOT" in
        "/home/dev/workspace/oppie-thunder")
            echo "3001"
            ;;
        "/home/dev/workspace/cui")
            echo "3002"
            ;;
        "/home/dev/workspace/oppie-growth-hacking")
            echo "3003"
            ;;
        *)
            # Auto-assign port based on hash of project path
            # Ensures consistent port for same project
            HASH=$(echo -n "$PROJECT_ROOT" | md5sum | cut -c1-4)
            PORT=$((3010 + 0x$HASH % 990))
            # Ensure port is in valid range (3010-4000)
            if [ $PORT -lt 3010 ]; then
                PORT=$((PORT + 3010))
            fi
            echo "$PORT"
            ;;
    esac
}

# Assign port for this project
PORT=$(assign_port)
CONFIG_DIR="$HOME/.cui-instances/$PROJECT_NAME"
CONFIG_FILE="$CONFIG_DIR/config.json"
PID_FILE="$CONFIG_DIR/cui.pid"
LOG_FILE="$CONFIG_DIR/cui.log"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       CUI Project Instance Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Project:${NC} $PROJECT_NAME"
echo -e "${YELLOW}Path:${NC}    $PROJECT_ROOT"
echo -e "${YELLOW}Port:${NC}    $PORT"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Check if CUI is installed
if [ ! -d "$CUI_BASE" ]; then
    echo -e "${RED}✗ CUI not found at $CUI_BASE${NC}"
    echo -e "${YELLOW}Please clone CUI first:${NC}"
    echo "  git clone <cui-repo> $CUI_BASE"
    exit 1
fi

# Create instance config directory
echo -e "${YELLOW}→ Creating instance configuration...${NC}"
mkdir -p "$CONFIG_DIR"

# Generate unique auth token for this instance
AUTH_TOKEN=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 32 | head -n 1)

# Get machine's public IP
PUBLIC_IP=$(hostname -I | awk '{print $1}')

# Create instance-specific configuration
cat > "$CONFIG_FILE" << EOF
{
  "machine_id": "cui-${PROJECT_NAME}",
  "authToken": "${AUTH_TOKEN}",
  "projectRoot": "${PROJECT_ROOT}",
  "server": {
    "host": "0.0.0.0",
    "port": ${PORT},
    "https": {
      "enabled": false
    }
  },
  "gemini": {
    "enabled": true,
    "apiKey": "AIzaSyA3_f8odT4InRKJ_dIEGDdyiJT3hltzUIg"
  },
  "interface": {
    "colorScheme": "system",
    "language": "en"
  }
}
EOF

echo -e "${GREEN}✓ Configuration created${NC}"

# Check if instance is already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Instance already running on port $PORT (PID: $OLD_PID)${NC}"
        echo -e "  Stop it with: ${BLUE}$0 stop${NC}"
        echo -e "\n${GREEN}Access your CUI instance at:${NC}"
        echo -e "  ${BLUE}http://${PUBLIC_IP}:${PORT}${NC}"
        echo -e "  ${BLUE}http://localhost:${PORT}${NC}"
        exit 0
    else
        rm "$PID_FILE"
    fi
fi

# Check if port is already in use
if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${RED}✗ Port $PORT is already in use${NC}"
    echo -e "  Check running processes: ${BLUE}lsof -i :$PORT${NC}"
    exit 1
fi

# Build CUI if needed
echo -e "${YELLOW}→ Checking CUI build...${NC}"
cd "$CUI_BASE"
if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
    echo -e "${YELLOW}→ Building CUI...${NC}"
    npm install
    npm run build
fi

# Start CUI instance
echo -e "${YELLOW}→ Starting CUI instance for ${PROJECT_NAME}...${NC}"

# Export environment variables for this instance
export CUI_CONFIG_FILE="$CONFIG_FILE"
export CUI_PROJECT_ROOT="$PROJECT_ROOT"
export CUI_PORT="$PORT"
export CUI_INSTANCE_NAME="$PROJECT_NAME"

# Start the server with instance-specific config
cd "$PROJECT_ROOT"
nohup env CUI_CONFIG_FILE="$CONFIG_FILE" CUI_INSTANCE_NAME="$PROJECT_NAME" \
    node "$CUI_BASE/dist/server.js" \
    --port "$PORT" \
    --host "0.0.0.0" \
    > "$LOG_FILE" 2>&1 &

CUI_PID=$!
echo $CUI_PID > "$PID_FILE"

# Wait for server to start
echo -e "${YELLOW}→ Waiting for server to start...${NC}"
for i in {1..10}; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" | grep -q "200\|302"; then
        echo -e "${GREEN}✓ CUI instance started successfully!${NC}"
        break
    fi
    sleep 1
done

# Create stop script
STOP_SCRIPT="$CONFIG_DIR/stop.sh"
cat > "$STOP_SCRIPT" << 'STOPSCRIPT'
#!/bin/bash
PID_FILE="$(dirname "$0")/cui.pid"
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID"
        rm "$PID_FILE"
        echo "CUI instance stopped (PID: $PID)"
    else
        echo "Process not running"
        rm "$PID_FILE"
    fi
else
    echo "No PID file found"
fi
STOPSCRIPT
chmod +x "$STOP_SCRIPT"

# Create restart script
RESTART_SCRIPT="$CONFIG_DIR/restart.sh"
cat > "$RESTART_SCRIPT" << RESTARTSCRIPT
#!/bin/bash
"$CONFIG_DIR/stop.sh"
sleep 2
cd "$PROJECT_ROOT"
"$0"
RESTARTSCRIPT
chmod +x "$RESTART_SCRIPT"

# Create project-specific launcher
LAUNCHER="$PROJECT_ROOT/cui-start.sh"
cat > "$LAUNCHER" << LAUNCHERSCRIPT
#!/bin/bash
# Quick launcher for this project's CUI instance
cd "$PROJECT_ROOT"
$0
LAUNCHERSCRIPT
chmod +x "$LAUNCHER"

# Display success message
echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}       CUI Instance Ready!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Project:${NC}     $PROJECT_NAME"
echo -e "${YELLOW}Port:${NC}        $PORT"
echo -e "${YELLOW}Auth Token:${NC}  $AUTH_TOKEN"
echo -e "${YELLOW}Config:${NC}      $CONFIG_FILE"
echo -e "${YELLOW}Logs:${NC}        $LOG_FILE"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "\n${GREEN}Access URLs:${NC}"
echo -e "  Local:    ${BLUE}http://localhost:${PORT}${NC}"
echo -e "  Public:   ${BLUE}http://${PUBLIC_IP}:${PORT}${NC}"
echo -e "\n${GREEN}Quick Commands:${NC}"
echo -e "  Start:    ${BLUE}./cui-start.sh${NC}"
echo -e "  Stop:     ${BLUE}$CONFIG_DIR/stop.sh${NC}"
echo -e "  Restart:  ${BLUE}$CONFIG_DIR/restart.sh${NC}"
echo -e "  Logs:     ${BLUE}tail -f $LOG_FILE${NC}"
echo -e "\n${YELLOW}Tip:${NC} Add to your shell aliases:"
echo -e "  ${BLUE}alias cui-${PROJECT_NAME}='cd $PROJECT_ROOT && ./cui-start.sh'${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}\n"

# Handle command arguments
case "${1:-start}" in
    stop)
        "$CONFIG_DIR/stop.sh"
        ;;
    restart)
        "$CONFIG_DIR/restart.sh"
        ;;
    status)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Running (PID: $PID)${NC}"
            else
                echo -e "${RED}✗ Not running (stale PID file)${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ Not running${NC}"
        fi
        ;;
    logs)
        tail -f "$LOG_FILE"
        ;;
esac