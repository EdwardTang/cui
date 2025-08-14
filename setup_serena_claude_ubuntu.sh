#!/usr/bin/env bash
set -euo pipefail

# setup_serena_claude_ubuntu.sh
# One-click setup: integrate Serena (MCP server) with Claude Code for the current repo on Ubuntu.
#
# Usage:
#   chmod +x setup_serena_claude_ubuntu.sh
#   ./setup_serena_claude_ubuntu.sh [-p PROJECT_DIR] [-i] [-c CONTEXT]
#
# Options:
#   -p  Project directory (default: current working directory)
#   -i  Build Serena index for the project after wiring MCP (recommended for large repos)
#   -c  Serena context (default: ide-assistant)
#
# What this script does:
#   1) Verifies dependencies: git, curl, claude CLI
#   2) Installs Astral's `uv` if missing (tries official installer)
#   3) Registers Serena MCP with Claude Code for this project (stdio transport)
#   4) Optionally builds a project index to speed up LSP-backed tools
#   5) Prints next steps
#
# Notes:
#   - This only modifies Claude Code MCP configuration for the current user.
#   - It does NOT alter your codebase. Indexing writes metadata under .serena/
#   - If Claude Code is running, you may need to restart it to pick up changes.

PROJECT_DIR="$(pwd)"
DO_INDEX=0
CONTEXT="ide-assistant"

while getopts ":p:ic:" opt; do
  case $opt in
    p) PROJECT_DIR="$OPTARG" ;;
    i) DO_INDEX=1 ;;
    c) CONTEXT="$OPTARG" ;;
    \?) echo "Invalid option: -$OPTARG" >&2; exit 2 ;;
    :) echo "Option -$OPTARG requires an argument." >&2; exit 2 ;;
  esac
done

log() { echo -e "[\033[1;34mINFO\033[0m] $*"; }
warn() { echo -e "[\033[1;33mWARN\033[0m] $*" >&2; }
err() { echo -e "[\033[1;31mERROR\033[0m] $*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    return 1
  fi
}

# 1) Basic checks
if [[ ! -d "$PROJECT_DIR" ]]; then
  err "Project directory not found: $PROJECT_DIR"
  exit 1
fi

if ! git -C "$PROJECT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  warn "Project directory is not a git repo: $PROJECT_DIR"
  warn "Serena will still work, but git diff-based review will be unavailable."
fi

require_cmd curl || { warn "curl is recommended for installing uv automatically."; }
require_cmd claude || {
  err "Claude CLI not found. Please install Claude Code CLI first, then re-run."
  exit 1
}

# 2) Ensure `uvx` is available (install uv if needed)
if ! command -v uvx >/dev/null 2>&1; then
  log "uvx not found. Attempting to install Astral uv (this will run the official installer)."
  if command -v curl >/dev/null 2>&1; then
    # Install uv to ~/.local/bin by default
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # Ensure current session can see it
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi

if ! command -v uvx >/dev/null 2>&1; then
  err "uvx still not found after attempted install. Please ensure uv is on your PATH and re-run."
  exit 1
fi

# 3) Wire Serena MCP into Claude Code for this project (stdio transport)
ABS_PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
log "Registering Serena MCP for project: $ABS_PROJECT_DIR"
set +e
claude mcp add serena -- \
  uvx --from git+https://github.com/oraios/serena \
  serena start-mcp-server --context "$CONTEXT" --project "$ABS_PROJECT_DIR"
CODE=$?
set -e

if [[ $CODE -ne 0 ]]; then
  warn "claude mcp add returned non-zero (code=$CODE). It may already exist or Claude CLI changed."
  warn "We'll try to proceed anyway."
else
  log "Serena MCP registered successfully with Claude Code."
fi

# 4) Optional: build index (recommended for large repos)
if [[ "$DO_INDEX" -eq 1 ]]; then
  log "Building Serena index for the project (this can take a while on large repos)..."
  (cd "$ABS_PROJECT_DIR" && uvx --from git+https://github.com/oraios/serena serena project index) || {
    warn "Index build failed. You can try again later with: 
  (cd \"$ABS_PROJECT_DIR\" && uvx --from git+https://github.com/oraios/serena serena project index)"
  }
else
  log "Skipping index build. For large repos, consider running later:
  (cd \"$ABS_PROJECT_DIR\" && uvx --from git+https://github.com/oraios/serena serena project index)"
fi

# 5) Final hints
cat <<EOF

=== NEXT STEPS ===
1) Open Claude Code in this project and start a new chat.
2) If Serena tools do not appear, restart Claude Code.
3) In chat, you can say:
   - "激活项目 $ABS_PROJECT_DIR"
   - "执行 onboarding，为本项目写入记忆，再给我开发计划。"
4) 大仓建议先运行索引（如未执行 -i）：
   (cd "$ABS_PROJECT_DIR" && uvx --from git+https://github.com/oraios/serena serena project index)

Tips:
- 推荐在 Windows 以外的平台无需设置 autocrlf；Ubuntu 下无需特殊 git 配置。
- 若工具无响应，可在对话里运行：restart_language_server

Done.
EOF

exit 0
