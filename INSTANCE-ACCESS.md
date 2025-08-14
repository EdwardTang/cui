# CUI Multi-Instance Access Guide

## ✅ Fixed Issues
- Each instance now has isolated configuration and auth tokens
- Directory dropdown will now show at least the project directory
- Session information is stored separately per instance

## 🔐 Current Access Credentials

### oppie-thunder (Port 3001)
- **URL**: http://5.78.76.207:3001
- **Token**: `760467a2750cc57a91a488b8f0d9e3fc`
- **Config**: `~/.cui-instances/oppie-thunder/config.json`
- **Session**: `~/.cui-instances/oppie-thunder/session-info.json`
- **Logs**: `~/.cui-instances/oppie-thunder/cui.log`

### cui (Port 3002)
- **URL**: http://5.78.76.207:3002
- **Token**: `49da9240bb547b43ddbc8409347d1815`
- **Config**: `~/.cui-instances/cui/config.json`
- **Session**: `~/.cui-instances/cui/session-info.json`
- **Logs**: `~/.cui-instances/cui/cui.log`

### oppie-growth-hacking (Port 3003)
- **URL**: http://5.78.76.207:3003
- **Token**: `601d7a2308b2adbdbfe4d0439c5e7cd5`
- **Config**: `~/.cui-instances/oppie-growth-hacking/config.json`
- **Session**: `~/.cui-instances/oppie-growth-hacking/session-info.json`
- **Logs**: `~/.cui-instances/oppie-growth-hacking/cui.log`

## 📁 Storage Architecture

Each instance maintains its own isolated storage:

```
~/.cui-instances/
├── oppie-thunder/
│   ├── config.json         # Instance configuration & auth token
│   ├── session-info.json   # Session metadata & custom names
│   ├── cui.pid            # Process ID
│   ├── cui.log            # Instance logs
│   ├── stop.sh            # Stop script
│   └── restart.sh         # Restart script
├── cui/
│   └── (same structure)
└── oppie-growth-hacking/
    └── (same structure)
```

## 🔍 Directory Visibility

Each instance will show:
1. Its own project directory (always visible)
2. Any Claude CLI conversations for that project path
3. Other project directories if they have conversations in Claude's history

Note: CUI reads conversation history from `~/.claude/projects/` but filters and stores session info separately for each instance.

## 🎮 Management Commands

```bash
# View all instances with tokens
/home/dev/workspace/cui/cui-manager.sh list

# Restart all with new code
/home/dev/workspace/cui/cui-manager.sh restart-all

# Check specific instance logs
tail -f ~/.cui-instances/oppie-thunder/cui.log
tail -f ~/.cui-instances/cui/cui.log
tail -f ~/.cui-instances/oppie-growth-hacking/cui.log
```

## 🚀 Quick Test

Test isolation is working:
```bash
# Run the test script
/home/dev/workspace/cui/test-isolation.sh
```

All instances should reject cross-instance tokens and only accept their own.