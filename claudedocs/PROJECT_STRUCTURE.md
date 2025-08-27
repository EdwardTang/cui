# CUI Server (Vibe Whisper) - Project Structure Documentation

## Project Overview

**CUI Server** (v0.6.3) is a Web UI Agent Platform based on Claude Code, providing a comprehensive interface for AI-powered development assistance with voice mode capabilities.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (React)                      │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │   Chat UI  │  │ Voice Mode │  │  Tool Execution  │   │
│  └────────────┘  └────────────┘  └──────────────────┘   │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP/SSE
┌────────────────────────┴─────────────────────────────────┐
│                   Express Server                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Route Handlers                      │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────────┐  │    │
│  │  │ Conv │ │ Perm │ │Stream│ │ Notification │  │    │
│  └──┴──────┴─┴──────┴─┴──────┴─┴──────────────┴──┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Core Services                       │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐  │    │
│  │  │   Claude   │ │   Stream   │ │Permission │  │    │
│  │  │Process Mgr│ │  Manager   │ │  Tracker  │  │    │
│  │  └────────────┘ └────────────┘ └────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┴─────────────────────────────────┐
│              External Integrations                        │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────┐     │
│  │Claude CLI  │ │   Gemini   │ │      MCP         │     │
│  └────────────┘ └────────────┘ └──────────────────┘     │
└───────────────────────────────────────────────────────────┘
```

## Directory Structure

```
vibe-whisper/
├── src/                        # Source code
│   ├── server.ts              # Main server entry point
│   ├── cui-server.ts          # CUI server class
│   ├── cli-parser.ts          # CLI argument parsing
│   │
│   ├── services/              # Core business logic
│   │   ├── claude-process-manager.ts    # Claude CLI process management
│   │   ├── stream-manager.ts            # SSE stream handling
│   │   ├── conversation-status-manager.ts # Conversation state
│   │   ├── permission-tracker.ts        # Permission management
│   │   ├── voice-mode-service.ts        # Voice mode integration
│   │   ├── notification-service.ts      # Push notifications
│   │   ├── gemini-service.ts           # Gemini AI integration
│   │   ├── claude-router-service.ts    # Claude routing logic
│   │   ├── mcp-config-generator.ts     # MCP configuration
│   │   ├── file-system-service.ts      # File system operations
│   │   ├── config-service.ts           # Configuration management
│   │   ├── session-info-service.ts     # Session management
│   │   ├── working-directories-service.ts # Directory management
│   │   ├── web-push-service.ts         # Web push notifications
│   │   ├── ToolMetricsService.ts       # Tool usage metrics
│   │   ├── message-filter.ts           # Message filtering
│   │   ├── json-lines-parser.ts        # JSONL parsing
│   │   ├── log-formatter.ts            # Log formatting
│   │   ├── log-stream-buffer.ts        # Log buffering
│   │   └── logger.ts                   # Logging service
│   │
│   ├── routes/                # API endpoints
│   │   ├── conversation.routes.ts      # Conversation endpoints
│   │   ├── streaming.routes.ts         # SSE streaming
│   │   ├── permission.routes.ts        # Permission handling
│   │   ├── notifications.routes.ts     # Notification endpoints
│   │   ├── filesystem.routes.ts        # File system API
│   │   ├── config.routes.ts           # Configuration API
│   │   ├── gemini.routes.ts           # Gemini integration
│   │   ├── log.routes.ts              # Log endpoints
│   │   ├── system.routes.ts           # System information
│   │   └── working-directories.routes.ts # Directory management
│   │
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts           # Authentication
│   │   ├── cors-setup.ts     # CORS configuration
│   │   ├── error-handler.ts  # Error handling
│   │   ├── query-parser.ts   # Query parsing
│   │   └── request-logger.ts # Request logging
│   │
│   ├── mcp-server/           # Model Context Protocol
│   │   └── index.ts          # MCP server implementation
│   │
│   ├── types/                # TypeScript definitions
│   │   ├── index.ts          # Main type exports
│   │   ├── config.ts         # Configuration types
│   │   ├── express.ts        # Express extensions
│   │   ├── router-config.ts  # Router configuration
│   │   └── musistudio-llms.d.ts # LLM type definitions
│   │
│   ├── utils/                # Utility functions
│   │   ├── server-startup.ts # Server startup display
│   │   └── machine-id.ts     # Machine identification
│   │
│   └── web/                  # Frontend application
│       ├── chat/             # Chat interface
│       │   ├── components/   # React components
│       │   │   ├── Composer/         # Message composer
│       │   │   ├── Dialog/           # Dialog components
│       │   │   ├── CodeHighlight/    # Code highlighting
│       │   │   ├── PermissionDialog/ # Permission UI
│       │   │   └── WaveformVisualizer/ # Audio visualization
│       │   ├── hooks/        # React hooks
│       │   │   ├── useAudioRecording.ts # Audio recording
│       │   │   ├── useStreaming.ts      # SSE streaming
│       │   │   ├── useConversationMessages.ts # Message state
│       │   │   ├── usePreferences.ts    # User preferences
│       │   │   └── useTheme.ts         # Theme management
│       │   ├── services/     # Frontend services
│       │   │   └── api.ts    # API client
│       │   ├── types/        # TypeScript types
│       │   └── utils/        # Utility functions
│       │       ├── streamEventMapper.ts # Event mapping
│       │       ├── tool-utils.ts        # Tool utilities
│       │       └── language-detection.ts # Language detection
│       ├── hooks/            # Shared hooks
│       │   └── useAuth.ts    # Authentication hook
│       ├── sw.ts            # Service worker
│       └── vite-env.d.ts    # Vite environment types
│
├── tests/                    # Test suite
│   ├── __mocks__/           # Mock implementations
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── utils/               # Test utilities
│
├── voice-mode/              # Voice mode implementation
│   └── [Voice mode specific files]
│
├── public/                  # Static assets
├── scripts/                 # Build and utility scripts
├── docs/                    # Documentation
└── config/                  # Configuration files
```

## Key Components

### Core Services

#### ClaudeProcessManager
- **Location**: `src/services/claude-process-manager.ts`
- **Purpose**: Manages Claude CLI subprocess lifecycle
- **Key Features**:
  - Process spawning and termination
  - Stream handling
  - Error recovery
  - Command execution

#### StreamManager
- **Location**: `src/services/stream-manager.ts`
- **Purpose**: Handles Server-Sent Events (SSE) streaming
- **Key Features**:
  - Real-time message streaming
  - Connection management
  - Event buffering
  - Client synchronization

#### ConversationStatusManager
- **Location**: `src/services/conversation-status-manager.ts`
- **Purpose**: Tracks conversation state and metadata
- **Key Features**:
  - Status tracking
  - Message history
  - Tool execution monitoring
  - Metrics collection

#### VoiceModeService
- **Location**: `src/services/voice-mode-service.ts`
- **Purpose**: Voice interaction capabilities
- **Key Features**:
  - Audio recording
  - Speech recognition
  - Voice synthesis
  - Real-time transcription

### API Routes

#### Conversation Routes (`/api/conversations`)
- Start new conversations
- Resume existing conversations
- Retrieve conversation history
- Send messages

#### Streaming Routes (`/api/streaming`)
- SSE endpoint for real-time updates
- Message streaming
- Tool execution events
- Status updates

#### Permission Routes (`/api/permissions`)
- Request tool permissions
- Grant/deny permissions
- Retrieve permission status
- Permission persistence

### Frontend Components

#### Chat Interface
- Real-time message display
- Code highlighting
- Tool execution visualization
- Voice mode integration

#### Voice Mode
- Audio recording controls
- Waveform visualization
- Transcription display
- Voice command processing

## Technology Stack

### Backend
- **Runtime**: Node.js (>=20.19.0)
- **Framework**: Express.js
- **Language**: TypeScript
- **Process Management**: Child process spawning
- **Streaming**: Server-Sent Events (SSE)
- **Database**: Better SQLite3

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Code Highlighting**: Prism.js
- **Routing**: React Router

### AI Integrations
- **Claude**: @anthropic-ai/claude-code, @anthropic-ai/sdk
- **Gemini**: @google/genai
- **LLMs**: @musistudio/llms
- **MCP**: @modelcontextprotocol/sdk

### Development Tools
- **Testing**: Vitest
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Git Hooks**: Husky
- **Coverage**: Vitest Coverage

## Configuration

### Environment Variables
- `NODE_ENV`: Development/production mode
- `PORT`: Server port (default: 3001)
- `LOG_LEVEL`: Logging verbosity
- `CLAUDE_PATH`: Path to Claude CLI
- `MCP_CONFIG_PATH`: MCP configuration location

### Configuration Files
- `package.json`: Project dependencies and scripts
- `tsconfig.json`: TypeScript configuration
- `vite.config.mts`: Vite build configuration
- `vitest.config.ts`: Test configuration
- `tailwind.config.js`: Tailwind CSS configuration

## Build and Deployment

### Development
```bash
npm run dev         # Start development server
npm run dev:web     # Start Vite dev server
npm run test:watch  # Run tests in watch mode
```

### Production
```bash
npm run build       # Build for production
npm run start       # Start production server
```

### Testing
```bash
npm test           # Run all tests
npm run unit-tests # Run unit tests only
npm run test:coverage # Generate coverage report
```

## Integration Points

### Claude CLI
- Direct integration via subprocess
- JSONL communication protocol
- Tool execution support
- Permission management

### MCP (Model Context Protocol)
- Server implementation in `src/mcp-server/`
- Tool registration and execution
- Context management
- Permission handling

### Voice Mode
- WebRTC for audio capture
- Real-time transcription
- Voice synthesis integration
- Audio visualization

## Performance Considerations

- **Streaming**: Uses SSE for efficient real-time updates
- **Process Management**: Careful subprocess lifecycle management
- **Caching**: Conversation cache for improved performance
- **Buffering**: Log stream buffering to prevent memory issues
- **Connection Pooling**: Efficient database connection management

## Security Features

- Authentication middleware
- CORS configuration
- Permission tracking
- Input validation
- Secure file system access
- Web push encryption

## Monitoring and Metrics

- Tool usage metrics collection
- Performance monitoring
- Error tracking
- Request logging
- Session analytics