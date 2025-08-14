#!/usr/bin/env bash
set -euo pipefail

# superclaude_ubuntu_oneclick.sh
# Single-file Ubuntu bootstrap for SuperClaude_Framework into a target project.
#
# Examples:
#   bash superclaude_ubuntu_oneclick.sh --project .
#   ./superclaude_ubuntu_oneclick.sh --project . --model claude-3.5-sonnet --provider anthropic --yes
#
# Features:
#   - Self-chmod on first run (so next time you can run it directly with ./script).
#   - Verifies/installs git & curl (apt) with optional --yes to skip prompt.
#   - Clones/updates framework to SUPERCLAUDE_HOME (default: ~/.superclaude).
#   - Creates project config, env template, .gitignore, cache/logs.
#   - Idempotent; use --force to overwrite config/env files.
#
# Options:
#   -p, --project <path>    target project directory (default: .)
#       --model <name>      LLM model (default: claude-3.5-sonnet)
#       --provider <name>   anthropic | openai (default: anthropic)
#       --home <path>       SUPERCLAUDE_HOME override (default: ~/.superclaude)
#       --force             overwrite existing config/env files
#       --yes               auto-install missing deps without asking
#   -h, --help              show help

REPO_URL="https://github.com/SuperClaude-Org/SuperClaude_Framework.git"
SC_HOME_DEFAULT="${HOME}/.superclaude"

PROJECT_DIR="."
MODEL="claude-3.5-sonnet"
PROVIDER="anthropic"   # or openai
FORCE=0
ASSUME_YES=0
SC_HOME="${SUPERCLAUDE_HOME:-$SC_HOME_DEFAULT}"

# --- self-chmod (best-effort) ---
if [[ -n "${BASH_SOURCE[0]-}" ]]; then
  SCRIPT_PATH="${BASH_SOURCE[0]}"
else
  SCRIPT_PATH="$0"
fi
if [[ -f "$SCRIPT_PATH" && ! -x "$SCRIPT_PATH" ]]; then
  if chmod +x "$SCRIPT_PATH" 2>/dev/null; then
    echo "[INFO] Made the script executable: $SCRIPT_PATH"
  fi
fi

# --- parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--project) PROJECT_DIR="$2"; shift 2;;
    --model) MODEL="$2"; shift 2;;
    --provider) PROVIDER="$2"; shift 2;;
    --home) SC_HOME="$2"; shift 2;;
    --force) FORCE=1; shift;;
    --yes) ASSUME_YES=1; shift;;
    -h|--help)
      cat <<EOF
Usage: $(basename "$SCRIPT_PATH") [options]

Options:
  -p, --project <path>    Target project directory (default: .)
      --model <name>      Model name (default: claude-3.5-sonnet)
      --provider <name>   anthropic | openai (default: anthropic)
      --home <path>       SUPERCLAUDE_HOME override (default: ~/.superclaude)
      --force             Overwrite existing config/env files
      --yes               Auto-install missing deps (apt) without asking
  -h, --help              Show this help

Quickstart:
  # First run via bash; next time you can run it directly thanks to self-chmod:
  bash $(basename "$SCRIPT_PATH") --project . --yes
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

# --- OS info ---
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  info "Detected OS: ${NAME:-unknown} ${VERSION_ID:-}"
fi

# --- deps: git, curl ---
MISSING=()
need_cmd git  || MISSING+=("git")
need_cmd curl || MISSING+=("curl")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  warn "Missing dependencies: ${MISSING[*]}"
  if need_cmd apt-get && need_cmd sudo; then
    if [[ $ASSUME_YES -eq 1 ]]; then
      sudo apt-get update -y
      sudo apt-get install -y "${MISSING[@]}"
    else
      read -rp "Install with 'sudo apt-get install -y ${MISSING[*]}' now? [Y/n] " yn
      yn=${yn:-Y}
      if [[ "$yn" =~ ^[Yy]$ ]]; then
        sudo apt-get update -y
        sudo apt-get install -y "${MISSING[@]}"
      else
        err "Please install: ${MISSING[*]} and re-run."; exit 1
      fi
    fi
  else
    err "apt/sudo unavailable. Install: ${MISSING[*]} and re-run."; exit 1
  fi
fi

# --- prepare home ---
SC_HOME="$(mkdir -p "$SC_HOME" && cd "$SC_HOME" && pwd)"
info "SUPERCLAUDE_HOME: $SC_HOME"

# --- clone/update framework ---
REPO_DIR="$SC_HOME/SuperClaude_Framework"
if [[ -d "$REPO_DIR/.git" ]]; then
  info "Updating SuperClaude_Framework ..."
  git -C "$REPO_DIR" pull --ff-only
else
  info "Cloning SuperClaude_Framework ..."
  git clone --depth 1 "$REPO_URL" "$REPO_DIR"
fi

# --- project normalize ---
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
info "Target project: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR/.superclaude"

# --- .gitignore rules ---
GITIGNORE="$PROJECT_DIR/.gitignore"
if [[ ! -f "$GITIGNORE" ]] || ! grep -qE '^# SuperClaude$' "$GITIGNORE"; then
  info "Adding .gitignore entries"
  {
    echo "# SuperClaude"
    echo ".env"
    echo ".env.local"
    echo ".superclaude/cache/"
    echo ".superclaude/logs/"
  } >> "$GITIGNORE"
fi

# --- config.yaml ---
CONF="$PROJECT_DIR/.superclaude/config.yaml"
if [[ $FORCE -eq 1 || ! -f "$CONF" ]]; then
  info "Writing config: $CONF"
  cat > "$CONF" <<EOF
# SuperClaude project config (Ubuntu one-click)
framework_root: "$REPO_DIR"

runtime:
  provider: "$PROVIDER"
  model: "$MODEL"
  temperature: 0.2
  max_tokens: 4096

paths:
  workspace: "$PROJECT_DIR"
  cache_dir: ".superclaude/cache"
  logs_dir: ".superclaude/logs"

features:
  commands: true
  personas: true
  playbooks: true
EOF
else
  warn "Config exists: $CONF (use --force to overwrite)"
fi

# --- .env.local template ---
ENV_LOCAL="$PROJECT_DIR/.env.local"
if [[ $FORCE -eq 1 || ! -f "$ENV_LOCAL" ]]; then
  info "Writing env template: $ENV_LOCAL"
  cat > "$ENV_LOCAL" <<'EOF'
# ===== SuperClaude Environment (Ubuntu) =====
# Keep this file out of version control (added to .gitignore).

# Provider API Keys (set one or both as needed):
# export ANTHROPIC_API_KEY="paste-your-anthropic-key"
# export OPENAI_API_KEY="paste-your-openai-key"

# Optional home override:
# export SUPERCLAUDE_HOME="$HOME/.superclaude"

# Optional flags (comma-separated), see flags guide:
# export SUPERCLAUDE_FLAGS="safe_mode,verbose"
EOF
else
  warn "Env file exists: $ENV_LOCAL (use --force to overwrite)"
fi

# --- dirs ---
mkdir -p "$PROJECT_DIR/.superclaude/cache" "$PROJECT_DIR/.superclaude/logs"

cat <<EOF

✅ SuperClaude Ubuntu one-click setup complete!

Project: $PROJECT_DIR
Framework: $REPO_DIR
Config: $CONF
Env: $ENV_LOCAL

Next:
  - Open the project in your editor.
  - Put your API keys into: $ENV_LOCAL
  - Re-run this script with --force if you need to overwrite config/env.
  - Thanks to self-chmod, next time you can run:
      ./$(basename "$SCRIPT_PATH") --project "$PROJECT_DIR" --yes

EOF
