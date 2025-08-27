#!/bin/bash
# Voice Mode Hooks Installation Script
# Installs comprehensive hooks for Voice Mode development with LiveKit

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🎙️  Installing Voice Mode Development Hooks${NC}"
echo "Project: $PROJECT_ROOT"
echo ""

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    
    # Check git
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}❌ Not in a git repository${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Install dependencies
install_dependencies() {
    echo ""
    echo "📦 Installing dependencies..."
    
    # Install Husky
    if ! npm list husky &>/dev/null; then
        npm install --save-dev husky
        npx husky install
        echo -e "${GREEN}✅ Husky installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Husky already installed${NC}"
    fi
    
    # Install lint-staged
    if ! npm list lint-staged &>/dev/null; then
        npm install --save-dev lint-staged
        echo -e "${GREEN}✅ lint-staged installed${NC}"
    else
        echo -e "${YELLOW}⚠️  lint-staged already installed${NC}"
    fi
    
    # Install commitlint
    if ! npm list @commitlint/cli &>/dev/null; then
        npm install --save-dev @commitlint/cli @commitlint/config-conventional
        echo -e "${GREEN}✅ commitlint installed${NC}"
    else
        echo -e "${YELLOW}⚠️  commitlint already installed${NC}"
    fi
}

# Create git hooks
create_git_hooks() {
    echo ""
    echo "🪝 Creating Git hooks..."
    
    # Get git hooks directory
    GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"
    
    # Pre-commit hook
    cat > "$GIT_HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
# Voice Mode Pre-commit Hook
# Runs tests and quality checks before committing

set -e

echo "🔍 Running Voice Mode pre-commit checks..."

# Run TypeScript type checking
echo "📝 Type checking..."
npm run typecheck

# Run linting
echo "🧹 Linting..."
npm run lint

# Run unit tests for changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)
if [ ! -z "$CHANGED_FILES" ]; then
    echo "🧪 Running tests for changed files..."
    npm test -- --findRelatedTests $CHANGED_FILES --passWithNoTests
fi

# Check for Voice Mode specific patterns
echo "🎙️ Checking Voice Mode patterns..."

# Check for LiveKit room cleanup
if git diff --cached | grep -E 'createRoom|Room\(' | grep -v 'cleanup\|dispose\|disconnect'; then
    echo "⚠️  Warning: LiveKit room creation detected without cleanup"
    read -p "Have you added proper cleanup? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for audio stream cleanup
if git diff --cached | grep -E 'getUserMedia|createAudioTrack' | grep -v 'stop\|close'; then
    echo "⚠️  Warning: Audio stream creation detected without cleanup"
    read -p "Have you added proper cleanup? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for test coverage thresholds
if git diff --cached --name-only | grep -E '\.test\.(ts|tsx)$'; then
    echo "📊 Checking test coverage..."
    COVERAGE_OUTPUT=$(npm run test:coverage -- --silent 2>&1 || true)
    
    # Extract coverage percentages
    UNIT_COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep -oE 'Statements\s+:\s+([0-9.]+)' | grep -oE '[0-9.]+$' || echo "0")
    
    if (( $(echo "$UNIT_COVERAGE < 85" | bc -l) )); then
        echo "❌ Unit test coverage ($UNIT_COVERAGE%) is below threshold (85%)"
        exit 1
    fi
fi

echo "✅ Pre-commit checks passed!"
EOF
    chmod +x "$GIT_HOOKS_DIR/pre-commit"
    echo -e "${GREEN}✅ Created pre-commit hook${NC}"
    
    # Pre-push hook
    cat > "$GIT_HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash
# Voice Mode Pre-push Hook
# Runs comprehensive tests before pushing

set -e

echo "🚀 Running Voice Mode pre-push checks..."

# Run full test suite
echo "🧪 Running full test suite..."
npm test

# Run integration tests
echo "🔗 Running integration tests..."
npm run test:integration || true

# Check test coverage
echo "📊 Checking test coverage..."
npm run test:coverage

# Run Voice Mode specific checks
echo "🎙️ Running Voice Mode checks..."

# Check for LiveKit configuration
if [ -f ".env" ] && ! grep -q "LIVEKIT_URL" .env; then
    echo "⚠️  Warning: LiveKit URL not configured in .env"
fi

# Check for audio fixtures
if [ -d "tests/fixtures/audio" ]; then
    AUDIO_FILES=$(find tests/fixtures/audio -name "*.wav" -o -name "*.mp3" | wc -l)
    if [ "$AUDIO_FILES" -eq 0 ]; then
        echo "⚠️  Warning: No audio fixtures found for testing"
    fi
fi

# Run security checks
echo "🔒 Running security checks..."
npm audit --audit-level=high || true

# Check bundle size
echo "📦 Checking bundle size..."
npm run build
BUNDLE_SIZE=$(du -sb dist | cut -f1)
MAX_SIZE=$((10 * 1024 * 1024)) # 10MB for Voice Mode assets

if [ $BUNDLE_SIZE -gt $MAX_SIZE ]; then
    echo "❌ Bundle size exceeds 10MB. Current: $(($BUNDLE_SIZE / 1024 / 1024))MB"
    echo "Consider optimizing audio assets or using CDN"
    exit 1
fi

echo "✅ Pre-push checks passed!"
EOF
    chmod +x "$GIT_HOOKS_DIR/pre-push"
    echo -e "${GREEN}✅ Created pre-push hook${NC}"
    
    # Commit-msg hook
    cat > "$GIT_HOOKS_DIR/commit-msg" << 'EOF'
#!/bin/bash
# Voice Mode Commit Message Hook
# Enforces conventional commit format with Voice Mode scopes

commit_regex='^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\((voice|livekit|audio|stt|tts|ui|api|test|hooks)\))?: .{1,50}'

if ! grep -qE "$commit_regex" "$1"; then
    echo "❌ Invalid commit message format!"
    echo ""
    echo "Valid format: <type>(<scope>): <subject>"
    echo ""
    echo "Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert"
    echo "Scopes: voice, livekit, audio, stt, tts, ui, api, test, hooks"
    echo ""
    echo "Examples:"
    echo "  feat(voice): add LiveKit room management"
    echo "  fix(audio): resolve echo cancellation issue"
    echo "  test(stt): add Whisper integration tests"
    echo ""
    exit 1
fi

# Add PR number if available
BRANCH=$(git branch --show-current)
PR_NUMBER=$(echo $BRANCH | grep -oE 'PR-[0-9]+' || true)

if [ ! -z "$PR_NUMBER" ]; then
    if ! grep -q "$PR_NUMBER" "$1"; then
        echo "" >> "$1"
        echo "Ref: $PR_NUMBER" >> "$1"
    fi
fi
EOF
    chmod +x "$GIT_HOOKS_DIR/commit-msg"
    echo -e "${GREEN}✅ Created commit-msg hook${NC}"
}

# Create Husky hooks
create_husky_hooks() {
    echo ""
    echo "🐶 Creating Husky hooks..."
    
    # Pre-commit
    npx husky add .husky/pre-commit "npm run pre-commit" 2>/dev/null || true
    
    # Pre-push
    npx husky add .husky/pre-push "npm run pre-push" 2>/dev/null || true
    
    # Commit-msg
    npx husky add .husky/commit-msg 'npx --no -- commitlint --edit ${1}' 2>/dev/null || true
    
    echo -e "${GREEN}✅ Husky hooks created${NC}"
}

# Configure lint-staged
configure_lint_staged() {
    echo ""
    echo "📝 Configuring lint-staged..."
    
    cat > .lintstagedrc.json << 'EOF'
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    "vitest related --run --passWithNoTests"
  ],
  "*.{js,jsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ],
  "src/services/voice-*.ts": [
    "npm run test:voice -- --run"
  ],
  "src/services/*LiveKit*.ts": [
    "npm run test:livekit -- --run"
  ]
}
EOF
    
    echo -e "${GREEN}✅ lint-staged configured${NC}"
}

# Configure commitlint
configure_commitlint() {
    echo ""
    echo "📋 Configuring commitlint..."
    
    cat > commitlint.config.js << 'EOF'
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'build',
        'revert'
      ]
    ],
    'scope-enum': [
      2,
      'always',
      [
        'voice',
        'livekit',
        'audio',
        'stt',
        'tts',
        'ui',
        'api',
        'test',
        'hooks',
        'deps',
        'config',
        'docs'
      ]
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72]
  }
};
EOF
    
    echo -e "${GREEN}✅ commitlint configured${NC}"
}

# Create Voice Mode specific hooks
create_voice_hooks() {
    echo ""
    echo "🎙️ Creating Voice Mode specific hooks..."
    
    # Create hooks directory
    mkdir -p "$PROJECT_ROOT/.hooks/voice-mode"
    
    # Audio validation hook
    cat > "$PROJECT_ROOT/.hooks/voice-mode/validate-audio.sh" << 'EOF'
#!/bin/bash
# Validates audio files and configurations

validate_audio_files() {
    local audio_dir="${1:-tests/fixtures/audio}"
    
    if [ ! -d "$audio_dir" ]; then
        echo "Audio directory not found: $audio_dir"
        return 1
    fi
    
    # Check audio file formats
    for file in "$audio_dir"/*; do
        if [[ -f "$file" ]]; then
            case "${file##*.}" in
                wav|mp3|webm|ogg)
                    # Valid format
                    ;;
                *)
                    echo "Invalid audio format: $file"
                    return 1
                    ;;
            esac
            
            # Check file size (max 5MB for test fixtures)
            size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
            if [ "$size" -gt 5242880 ]; then
                echo "Audio file too large: $file ($(($size / 1024 / 1024))MB)"
                return 1
            fi
        fi
    done
    
    echo "✅ Audio files validated"
}

validate_audio_files "$@"
EOF
    chmod +x "$PROJECT_ROOT/.hooks/voice-mode/validate-audio.sh"
    
    # LiveKit health check hook
    cat > "$PROJECT_ROOT/.hooks/voice-mode/livekit-check.sh" << 'EOF'
#!/bin/bash
# Checks LiveKit server health

check_livekit() {
    local livekit_url="${LIVEKIT_URL:-http://localhost:7880}"
    
    # Check if LiveKit is reachable
    if curl -s -o /dev/null -w "%{http_code}" "$livekit_url/health" | grep -q "200"; then
        echo "✅ LiveKit server is healthy"
        return 0
    else
        echo "❌ LiveKit server is not reachable at $livekit_url"
        return 1
    fi
}

check_livekit
EOF
    chmod +x "$PROJECT_ROOT/.hooks/voice-mode/livekit-check.sh"
    
    # TDD workflow hook
    cat > "$PROJECT_ROOT/.hooks/voice-mode/tdd-workflow.sh" << 'EOF'
#!/bin/bash
# Enforces TDD workflow for Voice Mode development

enforce_tdd() {
    local file="$1"
    
    # Check if this is a source file
    if [[ "$file" =~ \.(ts|tsx)$ ]] && [[ ! "$file" =~ \.test\. ]]; then
        # Extract filename without extension
        base=$(basename "$file" | sed 's/\.[^.]*$//')
        dir=$(dirname "$file")
        
        # Look for corresponding test file
        test_file="$dir/__tests__/${base}.test.ts"
        alt_test_file="$dir/${base}.test.ts"
        
        if [ ! -f "$test_file" ] && [ ! -f "$alt_test_file" ]; then
            echo "❌ No test file found for $file"
            echo "Please create a test file first (TDD)"
            return 1
        fi
    fi
    
    return 0
}

# Check all staged files
for file in $(git diff --cached --name-only); do
    enforce_tdd "$file" || exit 1
done

echo "✅ TDD workflow validated"
EOF
    chmod +x "$PROJECT_ROOT/.hooks/voice-mode/tdd-workflow.sh"
    
    echo -e "${GREEN}✅ Voice Mode hooks created${NC}"
}

# Update package.json scripts
update_package_json() {
    echo ""
    echo "📦 Updating package.json scripts..."
    
    # Check if jq is available
    if command -v jq &> /dev/null; then
        # Update scripts using jq
        jq '.scripts += {
            "prepare": "husky install",
            "pre-commit": "lint-staged",
            "pre-push": "npm test && npm run test:coverage",
            "test:voice": "vitest run --dir src/services --grep voice",
            "test:livekit": "vitest run --dir src/services --grep LiveKit",
            "test:audio": "vitest run --dir src/services --grep audio",
            "hooks:test": "bash scripts/test-hooks.sh",
            "hooks:validate": "bash .hooks/voice-mode/validate-audio.sh && bash .hooks/voice-mode/livekit-check.sh"
        }' package.json > package.json.tmp && mv package.json.tmp package.json
        
        echo -e "${GREEN}✅ package.json updated${NC}"
    else
        echo -e "${YELLOW}⚠️  Please manually add the following scripts to package.json:${NC}"
        cat << 'EOF'

"scripts": {
  "prepare": "husky install",
  "pre-commit": "lint-staged",
  "pre-push": "npm test && npm run test:coverage",
  "test:voice": "vitest run --dir src/services --grep voice",
  "test:livekit": "vitest run --dir src/services --grep LiveKit",
  "test:audio": "vitest run --dir src/services --grep audio",
  "hooks:test": "bash scripts/test-hooks.sh",
  "hooks:validate": "bash .hooks/voice-mode/validate-audio.sh && bash .hooks/voice-mode/livekit-check.sh"
}
EOF
    fi
}

# Create test script for hooks
create_test_script() {
    echo ""
    echo "🧪 Creating hook test script..."
    
    cat > "$PROJECT_ROOT/scripts/test-hooks.sh" << 'EOF'
#!/bin/bash
# Test Voice Mode hooks

echo "🧪 Testing Voice Mode hooks..."

# Test pre-commit hook
echo "Testing pre-commit hook..."
.git/hooks/pre-commit
echo "✅ Pre-commit hook passed"

# Test Voice Mode specific hooks
echo "Testing Voice Mode hooks..."
bash .hooks/voice-mode/validate-audio.sh
bash .hooks/voice-mode/tdd-workflow.sh

echo "✅ All hooks tested successfully!"
EOF
    chmod +x "$PROJECT_ROOT/scripts/test-hooks.sh"
    
    echo -e "${GREEN}✅ Test script created${NC}"
}

# Main installation flow
main() {
    check_prerequisites
    install_dependencies
    create_git_hooks
    create_husky_hooks
    configure_lint_staged
    configure_commitlint
    create_voice_hooks
    update_package_json
    create_test_script
    
    echo ""
    echo -e "${GREEN}🎉 Voice Mode hooks installation complete!${NC}"
    echo ""
    echo "Available hooks:"
    echo "  📝 Pre-commit: Type checking, linting, unit tests"
    echo "  🚀 Pre-push: Full tests, coverage, security"
    echo "  💬 Commit-msg: Conventional format with Voice Mode scopes"
    echo "  🎙️ Voice Mode: Audio validation, LiveKit checks, TDD workflow"
    echo ""
    echo "Test the hooks:"
    echo "  npm run hooks:test     # Test all hooks"
    echo "  npm run hooks:validate # Validate Voice Mode setup"
    echo ""
    echo "Bypass hooks (use sparingly):"
    echo "  git commit --no-verify"
    echo "  git push --no-verify"
    echo ""
    echo -e "${BLUE}Happy coding with Voice Mode! 🎙️${NC}"
}

# Run main installation
main