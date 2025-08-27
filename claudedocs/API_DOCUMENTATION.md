# CUI Server API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication

Most endpoints require authentication via the `authMiddleware`. Authentication can be configured through environment variables or disabled for development.

```typescript
// Header format
Authorization: Bearer <token>
```

## API Endpoints

### Conversation Management

#### Start Conversation
```http
POST /api/conversations/start
```

**Request Body:**
```json
{
  "message": "Initial message to Claude",
  "workingDirectory": "/path/to/project",
  "mcpConfig": {
    "servers": {}
  }
}
```

**Response:**
```json
{
  "conversationId": "uuid-v4",
  "status": "started",
  "message": "Conversation started successfully"
}
```

#### Send Message
```http
POST /api/conversations/:conversationId/message
```

**Request Body:**
```json
{
  "message": "User message",
  "attachments": []
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "uuid-v4"
}
```

#### Get Conversation Status
```http
GET /api/conversations/:conversationId/status
```

**Response:**
```json
{
  "conversationId": "uuid-v4",
  "status": "active",
  "toolsUsed": ["read_file", "write_file"],
  "messageCount": 10,
  "startTime": "2024-01-01T00:00:00Z",
  "lastActivity": "2024-01-01T00:05:00Z"
}
```

#### List Conversations
```http
GET /api/conversations
```

**Query Parameters:**
- `limit`: Number of conversations to return (default: 20)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by status (active, completed, error)

**Response:**
```json
{
  "conversations": [
    {
      "conversationId": "uuid-v4",
      "status": "active",
      "startTime": "2024-01-01T00:00:00Z",
      "messageCount": 10
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### Stop Conversation
```http
POST /api/conversations/:conversationId/stop
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation stopped"
}
```

### Streaming

#### SSE Stream Endpoint
```http
GET /api/streaming/:conversationId
```

**Event Stream Format:**
```
event: message
data: {"type":"text","content":"Claude's response"}

event: tool_use
data: {"type":"tool_use","tool":"read_file","params":{"path":"file.txt"}}

event: status
data: {"type":"status","status":"thinking"}

event: error
data: {"type":"error","message":"An error occurred"}
```

**Event Types:**
- `message`: Text message from Claude
- `tool_use`: Tool execution event
- `tool_result`: Result from tool execution
- `status`: Status update (thinking, idle, etc.)
- `error`: Error message
- `done`: Conversation completed

### Permission Management

#### Request Permission
```http
POST /api/permissions/request
```

**Request Body:**
```json
{
  "conversationId": "uuid-v4",
  "tool": "write_file",
  "params": {
    "path": "/path/to/file.txt",
    "content": "File content"
  }
}
```

**Response:**
```json
{
  "permissionId": "uuid-v4",
  "status": "pending"
}
```

#### Grant Permission
```http
POST /api/permissions/:permissionId/grant
```

**Response:**
```json
{
  "success": true,
  "message": "Permission granted"
}
```

#### Deny Permission
```http
POST /api/permissions/:permissionId/deny
```

**Response:**
```json
{
  "success": true,
  "message": "Permission denied"
}
```

#### Get Permission Status
```http
GET /api/permissions/:permissionId
```

**Response:**
```json
{
  "permissionId": "uuid-v4",
  "tool": "write_file",
  "status": "granted",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### File System

#### List Directory
```http
GET /api/filesystem/list
```

**Query Parameters:**
- `path`: Directory path to list

**Response:**
```json
{
  "path": "/path/to/directory",
  "items": [
    {
      "name": "file.txt",
      "type": "file",
      "size": 1024,
      "modified": "2024-01-01T00:00:00Z"
    },
    {
      "name": "subdirectory",
      "type": "directory",
      "modified": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Read File
```http
GET /api/filesystem/read
```

**Query Parameters:**
- `path`: File path to read

**Response:**
```json
{
  "path": "/path/to/file.txt",
  "content": "File content",
  "encoding": "utf8"
}
```

#### Write File
```http
POST /api/filesystem/write
```

**Request Body:**
```json
{
  "path": "/path/to/file.txt",
  "content": "New file content"
}
```

**Response:**
```json
{
  "success": true,
  "path": "/path/to/file.txt",
  "bytes": 16
}
```

### Configuration

#### Get Configuration
```http
GET /api/config
```

**Response:**
```json
{
  "version": "0.6.3",
  "features": {
    "voiceMode": true,
    "mcp": true,
    "notifications": true
  },
  "limits": {
    "maxConversations": 10,
    "maxMessageLength": 10000
  }
}
```

#### Update Configuration
```http
PUT /api/config
```

**Request Body:**
```json
{
  "features": {
    "voiceMode": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "features": {
      "voiceMode": false
    }
  }
}
```

### Notifications

#### Register for Push Notifications
```http
POST /api/notifications/register
```

**Request Body:**
```json
{
  "subscription": {
    "endpoint": "https://push.service.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "subscriptionId": "uuid-v4"
}
```

#### Send Test Notification
```http
POST /api/notifications/test
```

**Request Body:**
```json
{
  "subscriptionId": "uuid-v4",
  "title": "Test Notification",
  "body": "This is a test"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent"
}
```

### System

#### Health Check
```http
GET /api/system/health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "0.6.3",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### System Information
```http
GET /api/system/info
```

**Response:**
```json
{
  "version": "0.6.3",
  "node": "20.19.0",
  "platform": "linux",
  "memory": {
    "total": 16777216,
    "used": 8388608,
    "free": 8388608
  },
  "cpu": {
    "cores": 8,
    "usage": 0.25
  }
}
```

#### Metrics
```http
GET /api/system/metrics
```

**Response:**
```json
{
  "conversations": {
    "active": 5,
    "total": 100
  },
  "tools": {
    "totalExecutions": 500,
    "byTool": {
      "read_file": 200,
      "write_file": 150,
      "execute_command": 150
    }
  },
  "performance": {
    "avgResponseTime": 250,
    "requestsPerMinute": 30
  }
}
```

### Working Directories

#### List Working Directories
```http
GET /api/working-directories
```

**Response:**
```json
{
  "directories": [
    {
      "path": "/home/user/project1",
      "name": "project1",
      "lastAccessed": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Add Working Directory
```http
POST /api/working-directories
```

**Request Body:**
```json
{
  "path": "/home/user/new-project"
}
```

**Response:**
```json
{
  "success": true,
  "directory": {
    "path": "/home/user/new-project",
    "name": "new-project"
  }
}
```

### Gemini Integration

#### Send Gemini Request
```http
POST /api/gemini/chat
```

**Request Body:**
```json
{
  "message": "User message for Gemini",
  "context": "Optional context",
  "model": "gemini-pro"
}
```

**Response:**
```json
{
  "response": "Gemini's response",
  "model": "gemini-pro",
  "usage": {
    "promptTokens": 100,
    "completionTokens": 150,
    "totalTokens": 250
  }
}
```

### Logs

#### Get Logs
```http
GET /api/logs
```

**Query Parameters:**
- `level`: Log level filter (debug, info, warn, error)
- `limit`: Number of log entries (default: 100)
- `since`: ISO timestamp for log start time

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "level": "info",
      "message": "Server started",
      "context": {}
    }
  ],
  "total": 1000,
  "limit": 100
}
```

#### Stream Logs
```http
GET /api/logs/stream
```

**Event Stream Format:**
```
event: log
data: {"timestamp":"2024-01-01T00:00:00Z","level":"info","message":"Log entry"}
```

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  },
  "statusCode": 400
}
```

### Common Error Codes

- `INVALID_REQUEST`: Malformed request data
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONVERSATION_NOT_ACTIVE`: Conversation is not active
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API endpoints implement rate limiting to prevent abuse:

- **Default limit**: 100 requests per minute per IP
- **Conversation endpoints**: 20 requests per minute
- **File system endpoints**: 50 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067260
```

## WebSocket Support (Future)

WebSocket support is planned for real-time bidirectional communication:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Received:', event);
});

ws.send(JSON.stringify({
  type: 'message',
  conversationId: 'uuid-v4',
  content: 'Hello Claude'
}));
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { CUIClient } from 'cui-client';

const client = new CUIClient({
  baseUrl: 'http://localhost:3001',
  apiKey: 'your-api-key'
});

// Start conversation
const conversation = await client.conversations.start({
  message: 'Hello Claude',
  workingDirectory: '/path/to/project'
});

// Stream responses
const stream = client.streaming.connect(conversation.id);
stream.on('message', (data) => {
  console.log('Claude:', data.content);
});

// Send message
await client.conversations.sendMessage(conversation.id, {
  message: 'Write a function to calculate fibonacci'
});
```

### Python
```python
from cui_client import CUIClient

client = CUIClient(
    base_url="http://localhost:3001",
    api_key="your-api-key"
)

# Start conversation
conversation = client.conversations.start(
    message="Hello Claude",
    working_directory="/path/to/project"
)

# Stream responses
for event in client.streaming.connect(conversation.id):
    if event.type == "message":
        print(f"Claude: {event.content}")

# Send message
client.conversations.send_message(
    conversation.id,
    message="Write a function to calculate fibonacci"
)
```

## Postman Collection

A Postman collection is available for testing:
- Import: `docs/postman/cui-server.postman_collection.json`
- Environment: `docs/postman/cui-server.postman_environment.json`

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
- Endpoint: `GET /api/openapi.json`
- File: `docs/openapi.yaml`