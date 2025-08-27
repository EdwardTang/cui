# CUI Server (Vibe Whisper)

> Web UI Agent Platform for Claude Code with Voice Mode Integration

[![Version](https://img.shields.io/npm/v/cui-server)](https://www.npmjs.com/package/cui-server)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19.0-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Overview

CUI Server is a powerful web-based interface for Claude Code that enables AI-assisted development through a modern web UI with voice interaction capabilities. It provides real-time streaming, tool execution visualization, and seamless integration with Claude's capabilities.

### Key Features

- 🎯 **Real-time Streaming** - Server-Sent Events (SSE) for instant updates
- 🎙️ **Voice Mode** - Natural voice interactions with Claude
- 🛠️ **Tool Execution** - Visual feedback for code operations
- 🔐 **Permission Management** - Granular control over tool usage
- 📊 **Metrics & Analytics** - Track tool usage and performance
- 🔄 **MCP Integration** - Model Context Protocol support
- 🌐 **Multi-LLM Support** - Claude, Gemini, and more
- 📱 **Push Notifications** - Web push for important updates

## Quick Start

### Prerequisites

- Node.js >= 20.19.0
- npm or yarn
- Claude CLI installed (`npm install -g @anthropic-ai/claude-code`)

### Installation

```bash
# Clone the repository
git clone https://github.com/bmpixel/cui.git vibe-whisper
cd vibe-whisper

# Install dependencies
npm install

# Start development server
npm run dev
```

The server will start on `http://localhost:3001`

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Web UI  │────▶│  Express Server │────▶│   Claude CLI    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
   [Voice Mode]           [SSE Streaming]          [Tool Execution]
```

## Configuration

### Environment Variables

```bash
# Server Configuration
NODE_ENV=development          # Environment (development/production)
PORT=3001                     # Server port
LOG_LEVEL=info               # Logging level (debug/info/warn/error)

# Claude Configuration
CLAUDE_PATH=/usr/local/bin/claude  # Path to Claude CLI
MCP_CONFIG_PATH=~/.mcp             # MCP configuration directory

# Authentication (optional)
AUTH_ENABLED=false           # Enable authentication
AUTH_TOKEN=your-secret-token # Authentication token

# Voice Mode
VOICE_MODE_ENABLED=true      # Enable voice features
VOICE_API_KEY=your-api-key  # Voice service API key
```

### MCP Configuration

Create `.mcp.json` in your project root:

```json
{
  "servers": {
    "filesystem": {
      "command": "mcp-server-filesystem",
      "args": ["--root", "."]
    },
    "git": {
      "command": "mcp-server-git",
      "args": []
    }
  }
}
```

## API Documentation

### Core Endpoints

#### Start a Conversation
```http
POST /api/conversations/start
Content-Type: application/json

{
  "message": "Hello Claude",
  "workingDirectory": "/path/to/project"
}
```

#### Stream Responses
```javascript
const eventSource = new EventSource('/api/streaming/conversation-id');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Claude:', data.content);
};
```

For complete API documentation, see [API_DOCUMENTATION.md](claudedocs/API_DOCUMENTATION.md)

## Voice Mode

Voice Mode enables natural voice interactions with Claude:

### Features
- Real-time speech recognition
- Voice synthesis for responses
- Audio waveform visualization
- Hands-free coding assistance

### Usage
1. Click the microphone button in the UI
2. Speak your request naturally
3. Claude responds with both text and voice
4. Continue the conversation hands-free

### Supported Commands
- "Hey Claude, write a function to..."
- "Can you explain this code?"
- "Debug the error on line 42"
- "Refactor this component"

## Development

### Project Structure
```
vibe-whisper/
├── src/
│   ├── server.ts           # Main entry point
│   ├── services/           # Core services
│   ├── routes/             # API endpoints
│   ├── middleware/         # Express middleware
│   └── web/               # React frontend
├── tests/                  # Test suite
├── voice-mode/            # Voice integration
└── public/                # Static assets
```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload
npm run dev:web      # Start Vite dev server only

# Building
npm run build        # Build for production
npm run clean        # Clean build artifacts

# Testing
npm test            # Run all tests
npm run unit-tests  # Run unit tests only
npm run test:coverage # Generate coverage report

# Quality
npm run lint        # Run ESLint
npm run typecheck   # Type checking
```

### Testing

```bash
# Run specific test file
npm test -- claude-process-manager.test.ts

# Run tests in watch mode
npm run test:watch

# Debug tests
npm run test:debug
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

#### Claude CLI Not Found
```bash
# Install Claude CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

#### Permission Errors
```bash
# Fix permissions
sudo chown -R $(whoami) ~/.cui
```

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## Performance

### Optimization Tips

1. **Enable Response Caching**: Reduces API calls
2. **Use Production Build**: Optimized bundle size
3. **Configure Rate Limiting**: Prevent abuse
4. **Enable Compression**: Reduce bandwidth usage

### Benchmarks

- **Startup Time**: < 2 seconds
- **Response Latency**: < 100ms
- **Concurrent Users**: 100+
- **Memory Usage**: ~150MB idle

## Security

### Best Practices

- Enable authentication in production
- Use HTTPS with SSL certificates
- Configure CORS appropriately
- Implement rate limiting
- Regular security updates

### Reporting Security Issues

Please report security vulnerabilities to security@example.com

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Anthropic](https://www.anthropic.com/) for Claude
- [Model Context Protocol](https://github.com/modelcontextprotocol) contributors
- Open source community

## Support

- 📧 Email: support@example.com
- 💬 Discord: [Join our server](https://discord.gg/example)
- 🐛 Issues: [GitHub Issues](https://github.com/bmpixel/cui/issues)
- 📖 Docs: [Documentation](https://docs.example.com)

## Roadmap

- [ ] WebSocket support for bidirectional communication
- [ ] Plugin system for custom tools
- [ ] Mobile app (React Native)
- [ ] Multi-user collaboration
- [ ] Advanced voice commands
- [ ] Custom model fine-tuning
- [ ] Kubernetes deployment support

---

Built with ❤️ by the CUI Team