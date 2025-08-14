#!/usr/bin/env bash
set -euo pipefail

# SC_oneclick_ubuntu.sh
# SuperClaude (Ubuntu) — one-click bootstrap + MCP servers (Context7, Sequential Thinking, Magic, Playwright)
#
# Quickstart:
#   bash SC_oneclick_ubuntu.sh --project . --yes
#   # (self-chmods; next time you can run: ./SC_oneclick_ubuntu.sh --project . --yes)
#
# Options:
#   -p, --project <path>    Target project directory (default: .)
#       --home <path>       SUPERCLAUDE_HOME override (default: ~/.superclaude)
#       --force             Overwrite existing config/env files
#       --no-mcp            Skip configuring MCP servers
#       --yes               Non-interactive apt installs (deps + Node LTS via NodeSource if needed)
#       --provider <name>   LLM provider (default: openai)
#       --model <name>      Default model (default: gpt-5)  # confirm actual ID in your OpenAI account
#
# What this script does:
#   1) Ensures deps: git, curl, claude CLI, Node>=18 + npx (offers NodeSource 20.x if too old)
#   2) Clones/updates SuperClaude_Framework into SUPERCLAUDE_HOME (~/.superclaude by default)
#   3) Writes project config at .superclaude/config.yaml with model routing & MCP orchestration
#   4) Writes .env.local (keys for OPENAI / MAGIC (21st.dev) / GOOGLE (Gemini) ) and updates .gitignore
#   5) Registers MCP servers with Claude Code CLI:
#        - Context7:            npx -y @upstash/context7-mcp
#        - Sequential Thinking: npx -y @modelcontextprotocol/server-sequential-thinking
#        - Magic (21st.dev):    npx @21st-dev/cli@latest install claude --api-key $MAGIC_API_KEY
#        - Playwright:          npx @playwright/mcp@latest
#
# Notes:
#   - GPT‑5 is used as a *placeholder* model id. Replace with your actual OpenAI model id if different.
#   - Gemini fallback is written as disabled by default (SC_ENABLE_GEMINI_FALLBACK=0) because SuperClaude docs
#     don’t yet confirm native Gemini provider routing. You can enable experimentally after you have a valid key.
#
# -----------------------------------------------------------------------------

REPO_URL="https://github.com/SuperClaude-Org/SuperClaude_Framework.git"
SC_HOME_DEFAULT="${HOME}/.superclaude"

PROJECT_DIR="."
SC_HOME="${SUPERCLAUDE_HOME:-$SC_HOME_DEFAULT}"
FORCE=0
ASSUME_YES=0
CONFIGURE_MCP=1
PROVIDER="openai"
MODEL="gpt-5"   # Placeholder; verify in your OpenAI account

# Self-chmod for convenience
SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
if [[ -f "$SCRIPT_PATH" && ! -x "$SCRIPT_PATH" ]]; then
  chmod +x "$SCRIPT_PATH" 2>/dev/null || true
fi

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--project) PROJECT_DIR="$2"; shift 2;;
    --home) SC_HOME="$2"; shift 2;;
    --force) FORCE=1; shift;;
    --no-mcp) CONFIGURE_MCP=0; shift;;
    --yes) ASSUME_YES=1; shift;;
    --provider) PROVIDER="$2"; shift 2;;
    --model) MODEL="$2"; shift 2;;
    -h|--help)
      cat <<EOF
Usage: $(basename "$SCRIPT_PATH") [options]
  -p, --project <path>    Target project (default: .)
      --home <path>       SUPERCLAUDE_HOME (default: ~/.superclaude)
      --force             Overwrite config/env if they exist
      --no-mcp            Skip MCP wiring
      --yes               Auto-install deps without prompts
      --provider <name>   LLM provider (default: openai)
      --model <name>      Default model (default: gpt-5 — verify true ID)
EOF
      exit 0
    ;;
    *)
      echo "[ERROR] Unknown option: $1" >&2; exit 2;;
  esac
done

info(){ echo -e "[\033[1;34mINFO\033[0m] $*"; }
warn(){ echo -e "[\033[1;33mWARN\033[0m] $*" >&2; }
err(){  echo -e "[\033[1;31mERROR\033[0m] $*" >&2; }

need_cmd(){ command -v "$1" >/dev/null 2>&1; }

prompt_yn(){
  local msg="$1"; local default="${2:-Y}"
  if [[ $ASSUME_YES -eq 1 ]]; then echo "Y"; return; fi
  read -rp "$msg [${default}/n] " yn; yn=${yn:-$default}; echo "$yn"
}

# OS banner
if [[ -f /etc/os-release ]]; then . /etc/os-release; info "Detected OS: ${NAME:-unknown} ${VERSION_ID:-}"; fi

# 1) Deps: git, curl, claude
MISSING=()
need_cmd git   || MISSING+=("git")
need_cmd curl  || MISSING+=("curl")
need_cmd claude || MISSING+=("claude")  # https://modelcontextprotocol.io/quickstart/user for Claude Code CLI

if [[ ${#MISSING[@]} -gt 0 ]]; then
  warn "Missing deps: ${MISSING[*]}"
  if need_cmd apt-get && need_cmd sudo; then
    if [[ "$(prompt_yn "Install with apt-get?" Y)" =~ ^[Yy]$ ]]; then
      sudo apt-get update -y
      sudo apt-get install -y "${MISSING[@]}"
    else
      err "Please install: ${MISSING[*]} and re-run."; exit 1
    fi
  else
    err "apt/sudo not available. Install deps and re-run."; exit 1
  fi
fi

# Node + npx (need >=18)
NEED_NODE=0
if ! need_cmd node; then NEED_NODE=1
else
  NV=$(node -v | sed 's/v//')
  MAJOR=${NV%%.*}
  if [[ "$MAJOR" -lt 18 ]]; then NEED_NODE=1; fi
fi
if ! need_cmd npx; then NEED_NODE=1; fi

if [[ $NEED_NODE -eq 1 ]]; then
  warn "Node.js >=18 with npx is required for MCP servers."
  if need_cmd curl && need_cmd sudo && need_cmd apt-get; then
    if [[ "$(prompt_yn "Install NodeSource Node 20.x LTS?" Y)" =~ ^[Yy]$ ]]; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    else
      err "Please install Node >=18 (with npx) and re-run."; exit 1
    fi
  else
    err "Cannot auto-install Node. Install manually and re-run."; exit 1
  fi
fi

# 2) Prepare SUPERCLAUDE_HOME and clone/update framework
SC_HOME="$(mkdir -p "$SC_HOME" && cd "$SC_HOME" && pwd)"
info "SUPERCLAUDE_HOME: $SC_HOME"
REPO_DIR="$SC_HOME/SuperClaude_Framework"
if [[ -d "$REPO_DIR/.git" ]]; then
  info "Updating SuperClaude_Framework ..."; git -C "$REPO_DIR" pull --ff-only
else
  info "Cloning SuperClaude_Framework ..."; git clone --depth 1 "$REPO_URL" "$REPO_DIR"
fi

# 3) Project setup
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
info "Target project: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR/.superclaude"

# .gitignore
GITIGNORE="$PROJECT_DIR/.gitignore"
if [[ ! -f "$GITIGNORE" ]] || ! grep -qE '^# SuperClaude$' "$GITIGNORE"; then
  info "Updating .gitignore"
  {
    echo "# SuperClaude"
    echo ".env"
    echo ".env.local"
    echo ".superclaude/cache/"
    echo ".superclaude/logs/"
  } >> "$GITIGNORE"
fi

# 4) .env.local (keys & toggles)
ENV_LOCAL="$PROJECT_DIR/.env.local"
if [[ $FORCE -eq 1 || ! -f "$ENV_LOCAL" ]]; then
  info "Writing env: $ENV_LOCAL"
  cat > "$ENV_LOCAL" <<'EOF'
# ===== SuperClaude Environment (Ubuntu) =====
# Keep this file out of version control (added to .gitignore).

# Primary provider (OpenAI)
# export OPENAI_API_KEY="paste-your-openai-key"

# 21st.dev Magic API key (optional; required for Magic MCP full features)
# export MAGIC_API_KEY="paste-your-21stdev-magic-api-key"

# Google Gemini (experimental fallback; SuperClaude may not natively route yet)
# export GOOGLE_API_KEY="paste-your-google-api-key"

# Toggle experimental Gemini fallback routing (0/1)
# export SC_ENABLE_GEMINI_FALLBACK=0
EOF
else
  warn "Env exists: $ENV_LOCAL (use --force to overwrite)"
fi

# Try to import MAGIC_API_KEY / SC_ENABLE_GEMINI_FALLBACK if user already placed them
set +o allexport
if [[ -f "$ENV_LOCAL" ]]; then set -a; source "$ENV_LOCAL" || true; set +a; fi
set -o allexport

# 5) config.yaml with model routing & MCP orchestration
CONF="$PROJECT_DIR/.superclaude/config.yaml"
if [[ $FORCE -eq 1 || ! -f "$CONF" ]]; then
  info "Writing config: $CONF"
  cat > "$CONF" <<EOF
# SuperClaude project config (Ubuntu one-click)
framework_root: "$REPO_DIR"

runtime:
  provider: "$PROVIDER"
  default_model: "$MODEL"   # verify actual model id
  routes:
    design:        { model: "$MODEL", reasoning: high }
    analyze:       { model: "$MODEL", reasoning: high }
    research:      { model: "$MODEL", reasoning: high }
    deep_dive:     { model: "$MODEL", reasoning: high }
    troubleshoot:  { model: "$MODEL", reasoning: high }
    code:          { model: "$MODEL", reasoning: minimal }
  fallback:
    enabled: ${SC_ENABLE_GEMINI_FALLBACK:-0}
    provider: "google"
    model: "gemini-2.5-pro"  # requires GOOGLE_API_KEY and adapter support

mcp_orchestration:
  priority_matrix:
    - task_server_affinity
    - performance_metrics
    - context_awareness
    - load_distribution
    - fallback_readiness
  servers:
    context7:
      enabled: true
      activation:
        automatic:  [imports_detected, framework_questions, scribe_persona]
        manual:     ["--c7","--context7"]
      tools: [resolve-library-id, get-library-docs]
    sequential:
      enabled: true
      activation:
        automatic:  [complex_debugging, system_design, think_flags]
        manual:     ["--seq","--sequential"]
      modes: [think, think-hard, ultrathink]
    magic:
      enabled: true
      activation:
        automatic:  [ui_component_requests, design_system_queries]
        manual:     ["--magic"]
      env_keys: [MAGIC_API_KEY]
    playwright:
      enabled: true
      activation:
        automatic:  [testing_workflows, e2e_generation, qa_persona]
        manual:     ["--play","--playwright"]

EOF
else
  warn "Config exists: $CONF (use --force to overwrite)"
fi

# 6) Dirs
mkdir -p "$PROJECT_DIR/.superclaude/cache" "$PROJECT_DIR/.superclaude/logs"

# 7) MCP servers (Claude Code CLI)
if [[ $CONFIGURE_MCP -eq 1 ]]; then
  info "Configuring MCP servers via Claude Code CLI..."

  # Context7
  set +e
  claude mcp add context7 -- npx -y @upstash/context7-mcp
  CODE=$?
  set -e
  if [[ $CODE -ne 0 ]]; then warn "Context7: 'claude mcp add' non-zero (maybe already added)."; else info "Context7 MCP added."; fi

  # Sequential Thinking
  set +e
  claude mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
  CODE=$?
  set -e
  if [[ $CODE -ne 0 ]]; then warn "Sequential Thinking: 'claude mcp add' non-zero."; else info "Sequential Thinking MCP added."; fi

  # Playwright
  set +e
  claude mcp add playwright -- npx @playwright/mcp@latest
  CODE=$?
  set -e
  if [[ $CODE -ne 0 ]]; then warn "Playwright: 'claude mcp add' non-zero."; else info "Playwright MCP added."; fi

  # Magic (21st.dev): prefer official CLI so it writes API key config
  if [[ -n "${MAGIC_API_KEY:-}" ]]; then
    info "Installing Magic MCP (21st.dev) for Claude via official CLI..."
    set +e
    npx @21st-dev/cli@latest install claude --api-key "$MAGIC_API_KEY"
    CODE=$?
    set -e
    if [[ $CODE -ne 0 ]]; then
      warn "Magic CLI install failed; falling back to claude mcp add with env API_KEY (may prompt later)."
      set +e
      claude mcp add magic -- env API_KEY="$MAGIC_API_KEY" npx -y @21st-dev/magic@latest
      CODE=$?
      set -e
      if [[ $CODE -ne 0 ]]; then warn "Magic MCP add failed; configure manually later."; else info "Magic MCP added (fallback)."; fi
    else
      info "Magic MCP installed via CLI."
    fi
  else
    warn "MAGIC_API_KEY not set; skipping Magic MCP. Add key in $ENV_LOCAL and re-run with --force."
  fi
else
  warn "Skipped MCP configuration (--no-mcp)."
fi

cat <<EOF

✅ SuperClaude bootstrap complete!

Project:     $PROJECT_DIR
Framework:   $REPO_DIR
Config:      $CONF
Env:         $ENV_LOCAL

Next steps:
  1) Put your API keys into: $ENV_LOCAL
     - OPENAI_API_KEY=...
     - MAGIC_API_KEY=...   (for 21st.dev Magic)
     - GOOGLE_API_KEY=...  (if enabling Gemini fallback; experimental)
  2) Restart Claude Code so it picks up the new MCP servers.
  3) Start a new chat and try:
       /build --c7
       /analyze --seq --think-hard
       /ui --magic "responsive navbar with dark mode"
       /test e2e --play
  4) If any MCP add failed, re-run this script or configure manually.

Notes on compatibility:
  - Context7 MCP install uses NPX form recommended by upstream.
  - Sequential Thinking MCP uses official @modelcontextprotocol/server-sequential-thinking.
  - Playwright MCP uses official @playwright/mcp package.
  - 21st.dev Magic requires an API key; we use the official CLI to write Claude config.

EOF
