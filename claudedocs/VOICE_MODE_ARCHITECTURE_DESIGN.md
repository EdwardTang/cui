# Voice Mode System Architecture Design

## Executive Summary

This document presents a comprehensive system design for the Voice Mode feature in CUI Server (vibe-whisper), enabling real-time voice interactions between users and Claude. The architecture follows microservices principles with clear separation of concerns, scalable processing pipelines, and fault-tolerant design patterns.

## System Architecture Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Voice Mode System Architecture                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                        Presentation Layer                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │  Web UI  │  │Voice UI  │  │   API    │  │  WebSocket   │  │  │
│  │  │  (React) │  │Component │  │ Gateway  │  │   Handler    │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                        Application Layer                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │ Voice Mode   │  │  Session     │  │   Permission      │   │  │
│  │  │  Controller  │  │  Manager     │  │    Manager        │   │  │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │   Audio      │  │  Transcript  │  │   Response        │   │  │
│  │  │  Processor  │  │   Handler    │  │   Generator       │   │  │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                         Service Layer                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │   STT        │  │     TTS      │  │    Claude         │   │  │
│  │  │  Service     │  │   Service    │  │   Integration     │   │  │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │   Provider   │  │   Cache      │  │    Metrics        │   │  │
│  │  │   Manager    │  │   Service    │  │    Collector      │   │  │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                         Data Layer                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │  Session     │  │  Audio       │  │   Conversation    │   │  │
│  │  │  Storage     │  │  Storage     │  │     History       │   │  │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Communication Flow

```
┌──────┐     ┌────────┐     ┌──────────┐     ┌─────────┐     ┌────────┐
│Client│────▶│Gateway │────▶│Controller│────▶│Services │────▶│Storage │
└──────┘     └────────┘     └──────────┘     └─────────┘     └────────┘
   │             │                │                 │              │
   │             │                │                 │              │
   ▼             ▼                ▼                 ▼              ▼
[Audio]    [WebSocket]      [Orchestration]    [Processing]    [Persist]
```

## Core Components Design

### 1. Voice Mode Controller

```typescript
interface IVoiceModeController {
  // Session Management
  createSession(userId: string, config: SessionConfig): Promise<VoiceSession>;
  endSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): Promise<VoiceSession | null>;
  
  // Audio Processing Pipeline
  processAudioInput(sessionId: string, audio: AudioChunk): Promise<void>;
  streamAudioOutput(sessionId: string): AsyncIterable<AudioChunk>;
  
  // Command Processing
  processVoiceCommand(command: VoiceCommand): Promise<CommandResult>;
  registerCommandHandler(pattern: RegExp, handler: CommandHandler): void;
  
  // State Management
  getSessionState(sessionId: string): SessionState;
  updateSessionState(sessionId: string, state: Partial<SessionState>): void;
}

class VoiceModeController implements IVoiceModeController {
  private sessions: Map<string, VoiceSession>;
  private audioProcessor: IAudioProcessor;
  private transcriptionService: ITranscriptionService;
  private commandRegistry: CommandRegistry;
  private eventBus: EventEmitter;
  
  constructor(dependencies: ControllerDependencies) {
    this.sessions = new Map();
    this.audioProcessor = dependencies.audioProcessor;
    this.transcriptionService = dependencies.transcriptionService;
    this.commandRegistry = new CommandRegistry();
    this.eventBus = new EventEmitter();
  }
  
  async createSession(userId: string, config: SessionConfig): Promise<VoiceSession> {
    const session = new VoiceSession({
      id: generateId(),
      userId,
      config,
      state: SessionState.IDLE,
      createdAt: new Date()
    });
    
    this.sessions.set(session.id, session);
    await this.initializeSessionPipeline(session);
    
    return session;
  }
  
  private async initializeSessionPipeline(session: VoiceSession): Promise<void> {
    // Set up audio processing pipeline
    const audioStream = this.audioProcessor.createStream(session.id);
    
    // Connect transcription service
    audioStream.pipe(this.transcriptionService.createTranscriber({
      language: session.config.language,
      model: session.config.sttModel
    }));
    
    // Set up event handlers
    this.setupSessionEventHandlers(session);
  }
}
```

### 2. Audio Processing Service

```typescript
interface IAudioProcessor {
  // Stream Management
  createStream(sessionId: string): AudioStream;
  destroyStream(sessionId: string): void;
  
  // Audio Processing
  processChunk(chunk: AudioChunk): ProcessedAudio;
  applyFilters(audio: ProcessedAudio, filters: AudioFilter[]): ProcessedAudio;
  
  // Format Conversion
  convertFormat(audio: AudioData, targetFormat: AudioFormat): AudioData;
  resample(audio: AudioData, targetRate: number): AudioData;
  
  // Analysis
  detectVoiceActivity(chunk: AudioChunk): VoiceActivityResult;
  analyzePitch(audio: AudioData): PitchAnalysis;
  calculateEnergy(chunk: AudioChunk): number;
}

class AudioProcessor implements IAudioProcessor {
  private streams: Map<string, AudioStream>;
  private vadDetector: VoiceActivityDetector;
  private noiseReducer: NoiseReducer;
  
  createStream(sessionId: string): AudioStream {
    const stream = new AudioStream({
      sessionId,
      bufferSize: 4096,
      sampleRate: 16000,
      channels: 1
    });
    
    // Apply audio processing pipeline
    stream
      .pipe(this.noiseReducer)
      .pipe(this.vadDetector)
      .pipe(this.normalizer);
    
    this.streams.set(sessionId, stream);
    return stream;
  }
  
  processChunk(chunk: AudioChunk): ProcessedAudio {
    // Apply processing stages
    let processed = chunk;
    
    // 1. Noise reduction
    processed = this.applyNoiseReduction(processed);
    
    // 2. Gain control
    processed = this.applyAutoGainControl(processed);
    
    // 3. Echo cancellation
    processed = this.applyEchoCancellation(processed);
    
    return {
      data: processed,
      metadata: {
        timestamp: Date.now(),
        energy: this.calculateEnergy(processed),
        vadState: this.detectVoiceActivity(processed)
      }
    };
  }
}
```

### 3. Transcription Service Interface

```typescript
interface ITranscriptionService {
  // Transcription
  transcribe(audio: AudioData, options?: TranscriptionOptions): Promise<Transcript>;
  createTranscriber(config: TranscriberConfig): StreamTranscriber;
  
  // Language Detection
  detectLanguage(audio: AudioData): Promise<LanguageDetectionResult>;
  
  // Model Management
  loadModel(model: string): Promise<void>;
  unloadModel(model: string): Promise<void>;
  listAvailableModels(): string[];
}

interface StreamTranscriber extends Transform {
  on(event: 'partial', listener: (text: string) => void): this;
  on(event: 'final', listener: (transcript: Transcript) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

class TranscriptionService implements ITranscriptionService {
  private providers: Map<string, ITranscriptionProvider>;
  private activeProvider: ITranscriptionProvider;
  private cache: TranscriptionCache;
  
  async transcribe(audio: AudioData, options?: TranscriptionOptions): Promise<Transcript> {
    // Check cache first
    const cacheKey = this.generateCacheKey(audio, options);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    
    // Perform transcription
    const transcript = await this.activeProvider.transcribe(audio, options);
    
    // Cache result
    await this.cache.set(cacheKey, transcript);
    
    return transcript;
  }
  
  createTranscriber(config: TranscriberConfig): StreamTranscriber {
    return new StreamTranscriber({
      provider: this.activeProvider,
      config,
      onPartial: (text) => this.handlePartialTranscript(text),
      onFinal: (transcript) => this.handleFinalTranscript(transcript)
    });
  }
}
```

### 4. Voice Synthesis Service

```typescript
interface IVoiceSynthesisService {
  // Text-to-Speech
  synthesize(text: string, options?: SynthesisOptions): Promise<AudioData>;
  createSynthesizer(config: SynthesizerConfig): StreamSynthesizer;
  
  // Voice Management
  listVoices(): Promise<Voice[]>;
  setDefaultVoice(voiceId: string): void;
  
  // SSML Support
  synthesizeSSML(ssml: string, options?: SynthesisOptions): Promise<AudioData>;
}

class VoiceSynthesisService implements IVoiceSynthesisService {
  private providers: Map<string, ITTSProvider>;
  private activeProvider: ITTSProvider;
  private voiceCache: VoiceCache;
  
  async synthesize(text: string, options?: SynthesisOptions): Promise<AudioData> {
    const config = this.buildSynthesisConfig(text, options);
    
    // Check cache
    const cacheKey = this.generateCacheKey(text, config);
    const cached = await this.voiceCache.get(cacheKey);
    if (cached) return cached;
    
    // Synthesize
    const audio = await this.activeProvider.synthesize(text, config);
    
    // Post-process
    const processed = await this.postProcessAudio(audio, config);
    
    // Cache
    await this.voiceCache.set(cacheKey, processed);
    
    return processed;
  }
  
  private async postProcessAudio(
    audio: AudioData, 
    config: SynthesisConfig
  ): Promise<AudioData> {
    let processed = audio;
    
    // Apply speed adjustment
    if (config.speed !== 1.0) {
      processed = await this.adjustSpeed(processed, config.speed);
    }
    
    // Apply pitch adjustment
    if (config.pitch !== 0) {
      processed = await this.adjustPitch(processed, config.pitch);
    }
    
    // Apply volume normalization
    processed = await this.normalizeVolume(processed);
    
    return processed;
  }
}
```

## API Specifications

### REST API Endpoints

#### Voice Session Management

```yaml
/api/voice/sessions:
  post:
    summary: Create new voice session
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              userId:
                type: string
              config:
                $ref: '#/components/schemas/SessionConfig'
    responses:
      201:
        description: Session created
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VoiceSession'

/api/voice/sessions/{sessionId}:
  get:
    summary: Get session details
    parameters:
      - name: sessionId
        in: path
        required: true
        schema:
          type: string
    responses:
      200:
        description: Session details
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VoiceSession'
  
  delete:
    summary: End voice session
    parameters:
      - name: sessionId
        in: path
        required: true
        schema:
          type: string
    responses:
      204:
        description: Session ended

/api/voice/sessions/{sessionId}/audio:
  post:
    summary: Upload audio chunk
    parameters:
      - name: sessionId
        in: path
        required: true
        schema:
          type: string
    requestBody:
      content:
        audio/wav:
          schema:
            type: string
            format: binary
    responses:
      202:
        description: Audio accepted for processing
```

#### Voice Commands

```yaml
/api/voice/commands:
  post:
    summary: Execute voice command
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              sessionId:
                type: string
              command:
                type: string
              context:
                type: object
    responses:
      200:
        description: Command executed
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CommandResult'

/api/voice/commands/registry:
  get:
    summary: List available commands
    responses:
      200:
        description: Command list
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/CommandDefinition'
```

### WebSocket Protocol

```typescript
// WebSocket Message Types
enum WSMessageType {
  // Client -> Server
  AUDIO_CHUNK = 'audio_chunk',
  START_RECORDING = 'start_recording',
  STOP_RECORDING = 'stop_recording',
  COMMAND = 'command',
  
  // Server -> Client
  TRANSCRIPT_PARTIAL = 'transcript_partial',
  TRANSCRIPT_FINAL = 'transcript_final',
  AUDIO_RESPONSE = 'audio_response',
  COMMAND_RESULT = 'command_result',
  SESSION_STATE = 'session_state',
  ERROR = 'error'
}

// Message Formats
interface AudioChunkMessage {
  type: WSMessageType.AUDIO_CHUNK;
  sessionId: string;
  chunk: ArrayBuffer;
  timestamp: number;
}

interface TranscriptMessage {
  type: WSMessageType.TRANSCRIPT_PARTIAL | WSMessageType.TRANSCRIPT_FINAL;
  sessionId: string;
  text: string;
  confidence: number;
  timestamp: number;
}

interface AudioResponseMessage {
  type: WSMessageType.AUDIO_RESPONSE;
  sessionId: string;
  audio: ArrayBuffer;
  text: string;
  metadata: {
    duration: number;
    voice: string;
  };
}
```

### WebSocket Connection Flow

```
Client                          Server
  │                               │
  ├──── Connect WebSocket ────────▶
  │                               │
  ◀──── Session Created ───────────
  │                               │
  ├──── Start Recording ──────────▶
  │                               │
  ├──── Audio Chunk 1 ────────────▶
  ├──── Audio Chunk 2 ────────────▶
  ├──── Audio Chunk N ────────────▶
  │                               │
  ◀──── Transcript Partial ────────
  ◀──── Transcript Partial ────────
  ◀──── Transcript Final ──────────
  │                               │
  ◀──── Audio Response ────────────
  │                               │
  ├──── Stop Recording ───────────▶
  │                               │
  ◀──── Session State Update ──────
  │                               │
```

## Data Models

### Core Entities

```typescript
// Session Models
interface VoiceSession {
  id: string;
  userId: string;
  conversationId?: string;
  state: SessionState;
  config: SessionConfig;
  metrics: SessionMetrics;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionConfig {
  language: string;
  sttModel: string;
  ttsVoice: string;
  ttsSpeed: number;
  vadSensitivity: number;
  noiseReduction: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

enum SessionState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
  ERROR = 'error'
}

// Audio Models
interface AudioChunk {
  sessionId: string;
  data: ArrayBuffer;
  timestamp: number;
  sequenceNumber: number;
  metadata: AudioMetadata;
}

interface AudioMetadata {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: AudioFormat;
  duration: number;
}

// Transcription Models
interface Transcript {
  text: string;
  confidence: number;
  language: string;
  words?: Word[];
  alternatives?: Alternative[];
  timestamp: number;
}

interface Word {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

// Command Models
interface VoiceCommand {
  id: string;
  sessionId: string;
  text: string;
  intent: string;
  entities: Entity[];
  confidence: number;
  timestamp: Date;
}

interface CommandResult {
  commandId: string;
  success: boolean;
  action: string;
  result?: any;
  error?: Error;
  timestamp: Date;
}
```

## Scalability Design

### Horizontal Scaling Strategy

```yaml
# Kubernetes Deployment Example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voice-mode-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: voice-mode
  template:
    metadata:
      labels:
        app: voice-mode
    spec:
      containers:
      - name: voice-service
        image: cui-server/voice-mode:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: STT_PROVIDER
          value: "whisper"
        - name: TTS_PROVIDER
          value: "openai"
```

### Load Balancing

```nginx
upstream voice_backend {
    least_conn;
    server voice-1.internal:8080 weight=5;
    server voice-2.internal:8080 weight=5;
    server voice-3.internal:8080 weight=5;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name voice.api.example.com;
    
    location /api/voice {
        proxy_pass http://voice_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Caching Strategy

```typescript
class VoiceCacheManager {
  private redisClient: RedisClient;
  private localCache: LRUCache<string, any>;
  
  constructor() {
    this.redisClient = new RedisClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT
    });
    
    this.localCache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 5 // 5 minutes
    });
  }
  
  async get(key: string): Promise<any> {
    // L1 Cache - Local Memory
    const local = this.localCache.get(key);
    if (local) return local;
    
    // L2 Cache - Redis
    const redis = await this.redisClient.get(key);
    if (redis) {
      this.localCache.set(key, redis);
      return redis;
    }
    
    return null;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Write to both caches
    this.localCache.set(key, value);
    await this.redisClient.setex(key, ttl || 3600, value);
  }
}
```

## Security Considerations

### Authentication & Authorization

```typescript
interface VoiceAuthContext {
  userId: string;
  sessionId: string;
  permissions: VoicePermission[];
  rateLimits: RateLimits;
}

enum VoicePermission {
  VOICE_RECORD = 'voice.record',
  VOICE_SYNTHESIZE = 'voice.synthesize',
  COMMAND_EXECUTE = 'command.execute',
  SESSION_CREATE = 'session.create',
  SESSION_DELETE = 'session.delete'
}

class VoiceAuthMiddleware {
  async authenticate(req: Request): Promise<VoiceAuthContext> {
    const token = this.extractToken(req);
    const claims = await this.verifyToken(token);
    
    return {
      userId: claims.sub,
      sessionId: req.params.sessionId,
      permissions: await this.loadPermissions(claims.sub),
      rateLimits: await this.loadRateLimits(claims.sub)
    };
  }
  
  authorize(permission: VoicePermission): Middleware {
    return async (req, res, next) => {
      const auth = req.auth as VoiceAuthContext;
      
      if (!auth.permissions.includes(permission)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: permission
        });
      }
      
      next();
    };
  }
}
```

### Data Privacy

```typescript
class AudioPrivacyManager {
  // Encryption for stored audio
  async encryptAudio(audio: ArrayBuffer, userId: string): Promise<EncryptedAudio> {
    const key = await this.getUserKey(userId);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(audio)),
      cipher.final()
    ]);
    
    return {
      data: encrypted,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64')
    };
  }
  
  // Automatic data expiration
  async setAutoExpiration(sessionId: string, ttl: number): Promise<void> {
    await this.scheduler.schedule({
      jobId: `cleanup-${sessionId}`,
      executeAt: Date.now() + ttl,
      task: async () => {
        await this.deleteSessionData(sessionId);
      }
    });
  }
  
  // Anonymization
  anonymizeTranscript(transcript: string, userId: string): string {
    // Remove PII from transcripts
    return this.piiDetector.redact(transcript, {
      userId,
      patterns: ['email', 'phone', 'ssn', 'credit_card']
    });
  }
}
```

## Performance Optimization

### Audio Streaming Optimization

```typescript
class AudioStreamOptimizer {
  private bufferPool: BufferPool;
  private compressionEngine: CompressionEngine;
  
  optimizeStream(stream: ReadableStream): ReadableStream {
    return stream
      .pipeThrough(this.createChunker())
      .pipeThrough(this.createCompressor())
      .pipeThrough(this.createBatcher());
  }
  
  private createChunker(): TransformStream {
    return new TransformStream({
      transform: (chunk, controller) => {
        // Optimize chunk size for network transmission
        const optimalSize = 4096;
        const buffer = this.bufferPool.acquire(optimalSize);
        
        // Process chunk
        const processed = this.processChunk(chunk, buffer);
        controller.enqueue(processed);
        
        this.bufferPool.release(buffer);
      }
    });
  }
  
  private createCompressor(): TransformStream {
    return new TransformStream({
      transform: async (chunk, controller) => {
        // Apply Opus compression
        const compressed = await this.compressionEngine.compress(chunk, {
          codec: 'opus',
          bitrate: 24000,
          complexity: 5
        });
        
        controller.enqueue(compressed);
      }
    });
  }
}
```

### Response Time Optimization

```typescript
class ResponseOptimizer {
  private preloadCache: Map<string, AudioData>;
  private predictor: ResponsePredictor;
  
  async optimizeResponse(context: ConversationContext): Promise<void> {
    // Predict likely responses
    const predictions = await this.predictor.predict(context);
    
    // Preload top predictions
    for (const prediction of predictions.slice(0, 3)) {
      this.preloadResponse(prediction);
    }
  }
  
  private async preloadResponse(text: string): Promise<void> {
    if (this.preloadCache.has(text)) return;
    
    // Generate audio in background
    const audio = await this.synthesizeInBackground(text);
    this.preloadCache.set(text, audio);
    
    // Expire after 30 seconds
    setTimeout(() => {
      this.preloadCache.delete(text);
    }, 30000);
  }
}
```

## Monitoring & Observability

### Metrics Collection

```typescript
interface VoiceMetrics {
  // Latency metrics
  sttLatency: Histogram;
  ttsLatency: Histogram;
  e2eLatency: Histogram;
  
  // Quality metrics
  transcriptionAccuracy: Gauge;
  audioQuality: Gauge;
  
  // Usage metrics
  activeSessionCount: Gauge;
  commandExecutionRate: Counter;
  errorRate: Counter;
}

class MetricsCollector {
  private metrics: VoiceMetrics;
  
  recordSTTLatency(duration: number, labels: Labels): void {
    this.metrics.sttLatency.observe(labels, duration);
  }
  
  recordTranscriptionAccuracy(accuracy: number): void {
    this.metrics.transcriptionAccuracy.set(accuracy);
  }
  
  exportMetrics(): PrometheusMetrics {
    return {
      stt_latency_seconds: this.metrics.sttLatency.collect(),
      tts_latency_seconds: this.metrics.ttsLatency.collect(),
      e2e_latency_seconds: this.metrics.e2eLatency.collect(),
      transcription_accuracy: this.metrics.transcriptionAccuracy.collect(),
      active_sessions: this.metrics.activeSessionCount.collect(),
      command_rate: this.metrics.commandExecutionRate.collect(),
      error_rate: this.metrics.errorRate.collect()
    };
  }
}
```

### Distributed Tracing

```typescript
class VoiceTracer {
  private tracer: Tracer;
  
  traceVoiceSession(sessionId: string): Span {
    const span = this.tracer.startSpan('voice.session', {
      attributes: {
        'session.id': sessionId,
        'service.name': 'voice-mode',
        'service.version': VERSION
      }
    });
    
    return span;
  }
  
  traceAudioProcessing(parentSpan: Span, audioSize: number): Span {
    return this.tracer.startSpan('audio.process', {
      parent: parentSpan,
      attributes: {
        'audio.size': audioSize,
        'audio.format': 'wav',
        'processor.type': 'webrtc'
      }
    });
  }
}
```

## Deployment Architecture

### Container Architecture

```dockerfile
# Multi-stage build for Voice Mode Service
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Runtime image
FROM node:20-alpine

RUN apk add --no-cache ffmpeg python3 py3-pip
RUN pip3 install --no-cache-dir whisper

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/voice-server.js"]
```

### Infrastructure as Code

```terraform
# Terraform configuration for Voice Mode infrastructure
resource "aws_ecs_service" "voice_mode" {
  name            = "voice-mode-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.voice_mode.arn
  desired_count   = var.voice_service_count
  
  load_balancer {
    target_group_arn = aws_lb_target_group.voice_mode.arn
    container_name   = "voice-mode"
    container_port   = 8080
  }
  
  auto_scaling {
    min_capacity = 2
    max_capacity = 10
    
    target_tracking_scaling_policy {
      target_value = 70.0
      metric_type  = "CPU"
    }
  }
}
```

## Migration Strategy

### Phased Rollout Plan

```yaml
Phase 1 - Foundation (Week 1-2):
  - Set up core Voice Mode Service
  - Implement basic STT/TTS providers
  - Create WebSocket infrastructure
  - Deploy to staging environment

Phase 2 - Integration (Week 3-4):
  - Integrate with Claude Process Manager
  - Connect to existing permission system
  - Implement session management
  - Add monitoring and logging

Phase 3 - Enhancement (Week 5-6):
  - Add multiple provider support
  - Implement caching layer
  - Optimize audio processing
  - Add command recognition

Phase 4 - Production (Week 7-8):
  - Performance testing
  - Security audit
  - Documentation completion
  - Production deployment
```

## Testing Strategy

### Test Coverage Requirements

```typescript
// Unit Test Example
describe('VoiceModeController', () => {
  let controller: VoiceModeController;
  let mockAudioProcessor: jest.Mocked<IAudioProcessor>;
  let mockTranscriptionService: jest.Mocked<ITranscriptionService>;
  
  beforeEach(() => {
    mockAudioProcessor = createMockAudioProcessor();
    mockTranscriptionService = createMockTranscriptionService();
    
    controller = new VoiceModeController({
      audioProcessor: mockAudioProcessor,
      transcriptionService: mockTranscriptionService
    });
  });
  
  describe('createSession', () => {
    it('should create a new voice session', async () => {
      const session = await controller.createSession('user123', {
        language: 'en-US',
        sttModel: 'whisper-large'
      });
      
      expect(session).toHaveProperty('id');
      expect(session.userId).toBe('user123');
      expect(session.state).toBe(SessionState.IDLE);
    });
  });
});

// Integration Test Example
describe('Voice Mode E2E', () => {
  it('should complete full voice interaction flow', async () => {
    const client = new VoiceClient('ws://localhost:8080');
    
    // Connect and create session
    await client.connect();
    const session = await client.createSession();
    
    // Send audio and receive transcription
    const audioBuffer = loadTestAudio('hello-world.wav');
    await client.sendAudio(audioBuffer);
    
    const transcript = await client.waitForTranscript();
    expect(transcript.text).toContain('Hello world');
    
    // Receive and play response
    const response = await client.waitForAudioResponse();
    expect(response.audio).toBeDefined();
    expect(response.text).toContain('Hello! How can I help you?');
    
    await client.disconnect();
  });
});
```

## Conclusion

This comprehensive Voice Mode architecture design provides:

1. **Scalable Architecture**: Microservices-based design with clear separation of concerns
2. **Robust API Design**: RESTful and WebSocket protocols for real-time communication
3. **Performance Optimization**: Caching, streaming optimization, and response prediction
4. **Security & Privacy**: End-to-end encryption, PII protection, and authentication
5. **Observability**: Comprehensive metrics, tracing, and monitoring
6. **Deployment Strategy**: Container-based deployment with auto-scaling capabilities

The design ensures the Voice Mode feature can handle enterprise-scale usage while maintaining low latency and high reliability for real-time voice interactions.