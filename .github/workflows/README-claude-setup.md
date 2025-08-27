# Claude PR Assistant Setup Guide

## Overview

The Claude PR Assistant workflow (`claude-pr-assistant-oppie.yml`) provides AI-powered code reviews using Claude Code on self-hosted GitHub Actions runners with GPU support.

## Required Secrets

Configure these secrets in your repository settings (Settings → Secrets and variables → Actions):

### Claude Authentication (Required)

```yaml
CLAUDE_CODE_REFRESH_TOKEN   # Long-lived refresh token for Claude Code
CLAUDE_CODE_SESSION_KEY      # Session key for authentication
CLAUDE_CODE_API_KEY         # Fallback API key (optional)
ANTHROPIC_API_KEY           # Alternative API key (optional)
```

### LiveKit Configuration (For Voice Mode)

```yaml
LIVEKIT_API_KEY             # LiveKit API key
LIVEKIT_API_SECRET          # LiveKit API secret
```

### GitHub Token

```yaml
GITHUB_TOKEN                # Automatically provided by GitHub Actions
```

## Required Variables

Configure these variables in repository settings:

```yaml
LIVEKIT_URL                 # LiveKit server URL (default: ws://localhost:7880)
```

## Self-Hosted Runner Setup

### 1. Register Runner with GitHub

```bash
# On your self-hosted machine
cd /opt/actions-runner

# Configure runner (get token from GitHub repo settings)
./config.sh \
  --url https://github.com/YOUR_ORG/vibe-whisper \
  --token YOUR_RUNNER_TOKEN \
  --name vibe-whisper-gpu-01 \
  --labels self-hosted,linux,x64,gpu \
  --work /opt/claude-workspace

# Install as service
sudo ./svc.sh install
sudo ./svc.sh start
```

### 2. Install Required Software

The workflow expects these components on self-hosted runners:

```bash
# Core dependencies
- Node.js 20+
- Python 3.11+
- UV package manager
- Docker (optional, for containerized MCP servers)

# Voice Mode dependencies
- FFmpeg
- PortAudio
- LiveKit server
- Redis

# GPU support (optional)
- NVIDIA drivers
- CUDA toolkit
- nvidia-container-toolkit
```

### 3. Setup MCP Servers

```bash
# Install Serena MCP server
cd /opt/mcp-servers
git clone https://github.com/vitche/serena.git
cd serena
uv sync --extra dev

# Start Serena
uv run serena-mcp-server --port 9121
```

### 4. Directory Structure

Create required directories on runner:

```bash
sudo mkdir -p /opt/claude-workspace
sudo mkdir -p /var/cache/claude
sudo mkdir -p /var/log/claude
sudo mkdir -p /tmp/claude-runner

# Set permissions
sudo chown -R runner:runner /opt/claude-workspace
sudo chown -R runner:runner /var/cache/claude
sudo chown -R runner:runner /var/log/claude
sudo chown -R runner:runner /tmp/claude-runner
```

## Obtaining Claude Code Tokens

### Method 1: Using Claude Code CLI

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Authenticate and get refresh token
claude auth login
claude auth token --refresh

# Extract session key
claude config get session.key
```

### Method 2: Using Anthropic Dashboard

1. Go to https://console.anthropic.com/
2. Navigate to API Keys section
3. Create new Claude Code integration
4. Copy refresh token and session key

### Method 3: Programmatic Token Generation

```typescript
// scripts/generate-claude-tokens.ts
import { ClaudeAuth } from '@anthropic-ai/claude-code';

async function generateTokens() {
  const auth = new ClaudeAuth({
    email: process.env.ANTHROPIC_EMAIL,
    password: process.env.ANTHROPIC_PASSWORD
  });
  
  const { refreshToken, sessionKey } = await auth.authenticate();
  
  console.log('CLAUDE_CODE_REFRESH_TOKEN:', refreshToken);
  console.log('CLAUDE_CODE_SESSION_KEY:', sessionKey);
}

generateTokens();
```

## Workflow Triggers

The workflow runs automatically on:

- **Pull Request Events**: opened, synchronized, reopened, ready_for_review
- **Comments with @claude**: Triggers re-review when mentioned
- **Manual Dispatch**: Run manually from Actions tab

## Customization

### Adjust Review Depth

Modify the review depth logic in the workflow:

```yaml
# Comprehensive review for large PRs
if [ "$FILES_CHANGED" -gt 50 ]; then
  echo "review_depth=comprehensive"
fi
```

### Configure MCP Servers

Enable/disable MCP servers in env variables:

```yaml
env:
  SERENA_ENABLED: true      # Semantic code analysis
  CONTEXT7_ENABLED: true     # Documentation lookup
  SEQUENTIAL_ENABLED: true   # Deep reasoning
  MORPHLLM_ENABLED: true     # Bulk refactoring
  MAGIC_ENABLED: true        # UI generation
```

### Customize Claude Model

```yaml
env:
  CLAUDE_MODEL: claude-opus-4-1-20250805  # Or claude-sonnet-3-5
  CLAUDE_MAX_TOKENS: 32768
  CLAUDE_TEMPERATURE: 0.2
```

## Monitoring

### Check Runner Status

```bash
# On self-hosted runner
sudo ./svc.sh status

# Check runner health
/usr/local/bin/runner-monitor

# View logs
tail -f /var/log/claude/runner-health.log
tail -f /var/log/claude/claude-pr-assistant.log
```

### Debug Failed Reviews

```bash
# Check MCP server logs
tail -f /var/log/mcp-servers/serena.log

# Check Claude session logs
cat /tmp/claude-runner/claude-response.json

# Verify authentication
curl -H "Authorization: Bearer $CLAUDE_CODE_REFRESH_TOKEN" \
  https://api.anthropic.com/v1/claude-code/validate
```

## Security Best Practices

1. **Token Rotation**: Rotate refresh tokens every 90 days
2. **Network Security**: Restrict runner network access to required services
3. **Secret Management**: Use GitHub's secret scanning to prevent leaks
4. **Audit Logging**: Enable audit logs for runner activities
5. **Resource Limits**: Set CPU/memory limits for runner processes

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

```bash
# Regenerate tokens
claude auth logout
claude auth login
claude auth token --refresh > new_token.txt
```

#### 2. MCP Server Connection Issues

```bash
# Restart MCP servers
/usr/local/bin/mcp-server-manager restart

# Check port availability
lsof -i :9121
```

#### 3. GPU Not Detected

```bash
# Verify GPU drivers
nvidia-smi

# Check CUDA installation
nvcc --version

# Test GPU in Docker
docker run --rm --gpus all nvidia/cuda:11.8.0-base nvidia-smi
```

#### 4. Out of Memory Errors

```bash
# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=16384"

# Clear caches
rm -rf /var/cache/claude/*
rm -rf /tmp/claude-runner/*
```

## Performance Optimization

### 1. Cache Configuration

```yaml
env:
  UV_CACHE_DIR: /var/cache/uv
  NPM_CONFIG_CACHE: /var/cache/npm
  PIP_CACHE_DIR: /var/cache/pip
```

### 2. Parallel Execution

The workflow uses parallel execution for:
- MCP server startup
- Dependency installation
- Test execution
- Log analysis

### 3. GPU Utilization

For Voice Mode processing:
```bash
# Monitor GPU usage
watch -n 1 nvidia-smi

# Set CUDA visible devices
export CUDA_VISIBLE_DEVICES=0
```

## Support

For issues or questions:
- Check workflow logs in GitHub Actions
- Review runner logs on self-hosted machine
- Open issue in repository with `claude-assistant` label