# Voice Mode Development Hooks Setup

## Overview

This document configures Git hooks and development automation for Voice Mode implementation.

## Git Hooks Configuration

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "🔍 Running Voice Mode pre-commit checks..."

# Run linting
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed. Please fix errors before committing."
  exit 1
fi

# Run type checking
npm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ Type checking failed. Please fix type errors before committing."
  exit 1
fi

# Run unit tests for changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$')
if [ ! -z "$CHANGED_FILES" ]; then
  npm test -- --findRelatedTests $CHANGED_FILES
  if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Please fix failing tests before committing."
    exit 1
  fi
fi

# Check for console.log statements
if git diff --cached | grep -E '^\+.*console\.(log|error|warn|info)'; then
  echo "⚠️  Warning: console statements detected. Consider removing them."
  read -p "Continue with commit? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check for TODO comments
if git diff --cached | grep -E '^\+.*TODO'; then
  echo "⚠️  Warning: TODO comments detected."
  read -p "Continue with commit? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "✅ Pre-commit checks passed!"
```

### Pre-push Hook

```bash
#!/bin/bash
# .git/hooks/pre-push

echo "🚀 Running Voice Mode pre-push checks..."

# Run full test suite
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Please fix all tests before pushing."
  exit 1
fi

# Check test coverage
npm run test:coverage -- --silent
COVERAGE=$(npm run test:coverage -- --silent | grep "All files" | awk '{print $10}' | sed 's/%//')
if [ $(echo "$COVERAGE < 80" | bc) -eq 1 ]; then
  echo "❌ Test coverage is below 80%. Current: ${COVERAGE}%"
  exit 1
fi

# Run integration tests
npm run test:integration
if [ $? -ne 0 ]; then
  echo "❌ Integration tests failed."
  exit 1
fi

# Check bundle size
npm run build
BUNDLE_SIZE=$(du -sb dist | cut -f1)
MAX_SIZE=$((5 * 1024 * 1024)) # 5MB

if [ $BUNDLE_SIZE -gt $MAX_SIZE ]; then
  echo "❌ Bundle size exceeds 5MB. Current: $(($BUNDLE_SIZE / 1024 / 1024))MB"
  exit 1
fi

echo "✅ Pre-push checks passed!"
```

### Commit Message Hook

```bash
#!/bin/bash
# .git/hooks/commit-msg

# Check commit message format
commit_regex='^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,50}'

if ! grep -qE "$commit_regex" "$1"; then
  echo "❌ Invalid commit message format!"
  echo ""
  echo "Valid format: <type>(<scope>): <subject>"
  echo ""
  echo "Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert"
  echo ""
  echo "Example: feat(voice): add LiveKit integration"
  echo ""
  exit 1
fi

# Add ticket number if available
BRANCH=$(git branch --show-current)
TICKET=$(echo $BRANCH | grep -oE '[A-Z]+-[0-9]+')

if [ ! -z "$TICKET" ]; then
  # Check if ticket is already in message
  if ! grep -q "$TICKET" "$1"; then
    echo "" >> "$1"
    echo "Ref: $TICKET" >> "$1"
  fi
fi
```

## Husky Configuration

### Installation

```bash
npm install --save-dev husky
npx husky install
```

### Husky Hooks Setup

```json
// package.json
{
  "scripts": {
    "prepare": "husky install",
    "pre-commit": "lint-staged",
    "pre-push": "npm run test && npm run test:coverage"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --findRelatedTests --passWithNoTests"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

### Husky Hook Files

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
npm run typecheck
```

```bash
# .husky/pre-push
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run test
npm run test:integration
npm run build
```

```bash
# .husky/commit-msg
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx commitlint --edit $1
```

## Development Automation Hooks

### File Watcher Hooks

```javascript
// watch.config.js
module.exports = {
  watchers: [
    {
      // Auto-generate tests when new components are created
      pattern: 'src/components/**/*.tsx',
      onCreate: async (filepath) => {
        const testPath = filepath.replace('/components/', '/components/__tests__/')
                                 .replace('.tsx', '.test.tsx');
        
        if (!fs.existsSync(testPath)) {
          await generateTest(filepath, testPath);
          console.log(`✅ Generated test: ${testPath}`);
        }
      }
    },
    {
      // Auto-update documentation when services change
      pattern: 'src/services/**/*.ts',
      onChange: async (filepath) => {
        const docPath = filepath.replace('/services/', '/docs/services/')
                                .replace('.ts', '.md');
        
        await updateDocumentation(filepath, docPath);
        console.log(`📝 Updated documentation: ${docPath}`);
      }
    },
    {
      // Auto-format and lint on save
      pattern: '**/*.{ts,tsx,js,jsx}',
      onChange: async (filepath) => {
        await exec(`eslint --fix ${filepath}`);
        await exec(`prettier --write ${filepath}`);
        console.log(`✨ Formatted: ${filepath}`);
      }
    }
  ]
};
```

### Build Hooks

```javascript
// build-hooks.js
const { execSync } = require('child_process');

module.exports = {
  preBuild: async () => {
    console.log('🔨 Pre-build: Cleaning dist directory...');
    execSync('rm -rf dist');
    
    console.log('🔍 Pre-build: Running type check...');
    execSync('npm run typecheck');
    
    console.log('🧪 Pre-build: Running tests...');
    execSync('npm test');
  },
  
  postBuild: async () => {
    console.log('📊 Post-build: Analyzing bundle...');
    execSync('npm run analyze');
    
    console.log('📋 Post-build: Generating reports...');
    execSync('npm run generate-reports');
    
    console.log('✅ Build complete!');
  }
};
```

## CI/CD Hooks

### GitHub Actions Hooks

```yaml
# .github/workflows/voice-mode-hooks.yml
name: Voice Mode Hooks

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main, develop]

jobs:
  pre-merge-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run pre-merge hooks
        run: |
          npm run lint
          npm run typecheck
          npm run test
          npm run test:integration
          npm run test:e2e
      
      - name: Check code quality
        run: |
          npm run quality:check
          npm run security:audit
      
      - name: Generate reports
        run: |
          npm run test:coverage
          npm run bundle:analyze
      
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: voice-mode-reports
          path: |
            coverage/
            reports/
            dist/stats.html
```

### Deployment Hooks

```javascript
// deploy-hooks.js
module.exports = {
  preDeployment: async (environment) => {
    console.log(`🚀 Pre-deployment to ${environment}`);
    
    // Run safety checks
    await runSafetyChecks();
    
    // Backup current deployment
    await backupCurrentDeployment(environment);
    
    // Run smoke tests
    await runSmokeTests(environment);
  },
  
  postDeployment: async (environment) => {
    console.log(`✅ Post-deployment to ${environment}`);
    
    // Verify deployment
    await verifyDeployment(environment);
    
    // Run health checks
    await runHealthChecks(environment);
    
    // Send notifications
    await sendDeploymentNotification(environment);
  },
  
  rollbackHook: async (environment, reason) => {
    console.log(`⚠️  Rolling back ${environment}: ${reason}`);
    
    // Restore backup
    await restoreBackup(environment);
    
    // Notify team
    await notifyRollback(environment, reason);
  }
};
```

## Custom Hooks

### Voice Mode Specific Hooks

```javascript
// voice-mode-hooks.js
module.exports = {
  // Hook: Before starting voice session
  beforeVoiceSession: async (session) => {
    // Check microphone permissions
    await checkMicrophonePermissions();
    
    // Verify LiveKit connection
    await verifyLiveKitConnection();
    
    // Load user preferences
    await loadUserPreferences(session.userId);
    
    // Pre-warm STT/TTS services
    await prewarmServices();
  },
  
  // Hook: After voice session ends
  afterVoiceSession: async (session) => {
    // Save session transcript
    await saveTranscript(session);
    
    // Update usage metrics
    await updateMetrics(session);
    
    // Clean up resources
    await cleanupResources(session);
    
    // Send session summary
    await sendSessionSummary(session);
  },
  
  // Hook: On voice command
  onVoiceCommand: async (command) => {
    // Log command
    await logCommand(command);
    
    // Validate permissions
    await validatePermissions(command);
    
    // Apply rate limiting
    await applyRateLimit(command.userId);
    
    // Track usage
    await trackUsage(command);
  },
  
  // Hook: On transcription complete
  onTranscription: async (transcript) => {
    // Cache transcript
    await cacheTranscript(transcript);
    
    // Detect language
    const language = await detectLanguage(transcript);
    
    // Extract entities
    const entities = await extractEntities(transcript);
    
    // Update context
    await updateContext({ transcript, language, entities });
  }
};
```

### Performance Monitoring Hooks

```javascript
// performance-hooks.js
const { performance } = require('perf_hooks');

module.exports = {
  measurePerformance: (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const start = performance.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - start;
        
        // Log performance
        console.log(`⏱️  ${propertyKey}: ${duration.toFixed(2)}ms`);
        
        // Track metrics
        await trackMetric({
          method: propertyKey,
          duration,
          timestamp: Date.now()
        });
        
        // Alert if slow
        if (duration > 1000) {
          await alertSlowOperation({
            method: propertyKey,
            duration,
            args
          });
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        
        // Log error with timing
        console.error(`❌ ${propertyKey} failed after ${duration.toFixed(2)}ms`, error);
        
        throw error;
      }
    };
    
    return descriptor;
  }
};
```

## Hook Installation Script

```bash
#!/bin/bash
# install-hooks.sh

echo "🔧 Installing Voice Mode development hooks..."

# Install Husky
npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky install

# Create Husky hooks
npx husky add .husky/pre-commit "npx lint-staged"
npx husky add .husky/pre-push "npm run test && npm run build"
npx husky add .husky/commit-msg "npx commitlint --edit $1"

# Install Git hooks
cp .hooks/pre-commit .git/hooks/pre-commit
cp .hooks/pre-push .git/hooks/pre-push
cp .hooks/commit-msg .git/hooks/commit-msg
chmod +x .git/hooks/*

# Configure lint-staged
cat > .lintstagedrc.json << EOF
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    "jest --findRelatedTests --passWithNoTests"
  ],
  "*.{json,md,yml}": [
    "prettier --write"
  ]
}
EOF

# Configure commitlint
cat > commitlint.config.js << EOF
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
        'stt',
        'tts',
        'audio',
        'ui',
        'api',
        'test',
        'docs',
        'deps'
      ]
    ]
  }
};
EOF

echo "✅ Voice Mode hooks installed successfully!"
echo ""
echo "Available hooks:"
echo "  - Pre-commit: Linting, formatting, type checking"
echo "  - Pre-push: Tests, coverage, build validation"
echo "  - Commit-msg: Conventional commit format"
echo ""
echo "Run 'npm run hooks:test' to verify installation"
```

## Hook Testing

```javascript
// test-hooks.js
const { execSync } = require('child_process');

async function testHooks() {
  console.log('🧪 Testing Voice Mode hooks...\n');
  
  const tests = [
    {
      name: 'Pre-commit hook',
      test: () => execSync('bash .git/hooks/pre-commit', { stdio: 'inherit' })
    },
    {
      name: 'Commit message hook',
      test: () => {
        const testMessage = 'feat(voice): add test feature';
        execSync(`echo "${testMessage}" | bash .git/hooks/commit-msg /dev/stdin`);
      }
    },
    {
      name: 'Lint-staged',
      test: () => execSync('npx lint-staged', { stdio: 'inherit' })
    },
    {
      name: 'Husky hooks',
      test: () => execSync('npx husky run pre-commit', { stdio: 'inherit' })
    }
  ];
  
  for (const { name, test } of tests) {
    try {
      console.log(`Testing: ${name}`);
      await test();
      console.log(`✅ ${name} passed\n`);
    } catch (error) {
      console.error(`❌ ${name} failed:`, error.message, '\n');
    }
  }
  
  console.log('🎉 Hook testing complete!');
}

testHooks();
```

## Documentation

### Hook Usage Guide

```markdown
# Voice Mode Hooks Usage

## Pre-commit
Automatically runs before each commit:
- Lints TypeScript/JavaScript files
- Formats code with Prettier
- Runs type checking
- Executes related unit tests

## Pre-push
Automatically runs before pushing:
- Full test suite
- Coverage validation (>80%)
- Integration tests
- Bundle size check

## Commit Messages
Follow conventional commit format:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Code style
- refactor: Code refactoring
- test: Testing
- chore: Maintenance
- perf: Performance
- ci: CI/CD changes
- build: Build changes

Example: `feat(voice): implement LiveKit room management`

## Manual Hook Execution
```bash
# Run pre-commit checks
npm run hooks:pre-commit

# Run pre-push checks
npm run hooks:pre-push

# Validate commit message
npm run hooks:commit-msg "feat: test message"

# Test all hooks
npm run hooks:test
```
```