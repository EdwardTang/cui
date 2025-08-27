# Voice Mode with LiveKit - System Design

## Executive Summary

This document presents the updated Voice Mode architecture leveraging **LiveKit** as the core real-time communication infrastructure. LiveKit provides WebRTC-based audio/video streaming with built-in scalability, low latency, and production-ready features.

## LiveKit Architecture Overview

### Core Architecture with LiveKit

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Voice Mode with LiveKit Architecture                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                        Client Layer                              │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │   React UI   │  │  LiveKit     │  │   Voice Commands     │  │  │
│  │  │  Components  │  │  Client SDK  │  │    Interface         │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     LiveKit Infrastructure                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │   LiveKit    │  │   LiveKit    │  │    LiveKit           │  │  │
│  │  │    Server    │  │     SFU      │  │    Egress            │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │    Room      │  │    Track     │  │   Participant        │  │  │
│  │  │   Manager    │  │   Manager    │  │     Manager          │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     Voice Processing Layer                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │   Whisper    │  │   OpenAI     │  │     Claude           │  │  │
│  │  │     STT      │  │     TTS      │  │   Integration        │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │   Audio      │  │   Command    │  │    Session           │  │  │
│  │  │  Processor  │  │   Parser     │  │    Controller        │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

## LiveKit Integration Components

### 1. LiveKit Room Service

```typescript
import { Room, RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { Track, LocalTrack, RemoteTrack } from 'livekit-client';

interface ILiveKitRoomService {
  // Room Management
  createRoom(roomName: string, options?: RoomOptions): Promise<Room>;
  deleteRoom(roomName: string): Promise<void>;
  listRooms(): Promise<Room[]>;
  
  // Participant Management
  generateToken(roomName: string, participantId: string, permissions: TokenPermissions): Promise<string>;
  removeParticipant(roomName: string, participantId: string): Promise<void>;
  
  // Track Management
  muteTrack(roomName: string, participantId: string, trackSid: string): Promise<void>;
  unmuteTrack(roomName: string, participantId: string, trackSid: string): Promise<void>;
}

class LiveKitRoomService implements ILiveKitRoomService {
  private client: RoomServiceClient;
  private rooms: Map<string, Room>;
  
  constructor(config: LiveKitConfig) {
    this.client = new RoomServiceClient(
      config.host,
      config.apiKey,
      config.apiSecret
    );
    this.rooms = new Map();
  }
  
  async createRoom(roomName: string, options?: RoomOptions): Promise<Room> {
    const room = await this.client.createRoom({
      name: roomName,
      emptyTimeout: options?.emptyTimeout || 300,
      maxParticipants: options?.maxParticipants || 2,
      metadata: JSON.stringify({
        type: 'voice_session',
        createdAt: new Date().toISOString()
      })
    });
    
    this.rooms.set(roomName, room);
    return room;
  }
  
  async generateToken(
    roomName: string, 
    participantId: string, 
    permissions: TokenPermissions
  ): Promise<string> {
    const token = new AccessToken(
      this.config.apiKey,
      this.config.apiSecret,
      {
        identity: participantId,
        ttl: '6h'
      }
    );
    
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: permissions.canPublish,
      canSubscribe: permissions.canSubscribe,
      canPublishData: permissions.canPublishData
    });
    
    return token.toJwt();
  }
}
```

### 2. Voice Session Controller with LiveKit

```typescript
import { Room, RoomEvent, Participant, Track, DataPacket_Kind } from 'livekit-client';

interface IVoiceSessionController {
  // Session Lifecycle
  startSession(userId: string, config: VoiceSessionConfig): Promise<VoiceSession>;
  joinSession(sessionId: string, token: string): Promise<void>;
  leaveSession(sessionId: string): Promise<void>;
  
  // Audio Streaming
  startAudioStream(): Promise<LocalAudioTrack>;
  stopAudioStream(): Promise<void>;
  
  // Data Channel
  sendCommand(command: VoiceCommand): Promise<void>;
  sendTranscript(transcript: Transcript): Promise<void>;
}

class VoiceSessionController implements IVoiceSessionController {
  private room: Room | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private audioProcessor: AudioProcessor;
  private transcriptionService: TranscriptionService;
  
  async startSession(userId: string, config: VoiceSessionConfig): Promise<VoiceSession> {
    // Create LiveKit room
    const roomName = `voice_${userId}_${Date.now()}`;
    const room = await this.roomService.createRoom(roomName, {
      maxParticipants: 2,
      metadata: {
        userId,
        config
      }
    });
    
    // Generate access token
    const token = await this.roomService.generateToken(roomName, userId, {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });
    
    // Connect to room
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: undefined // Audio only
      }
    });
    
    await this.room.connect(LIVEKIT_URL, token);
    
    // Set up event handlers
    this.setupRoomEventHandlers();
    
    return {
      id: roomName,
      userId,
      token,
      status: 'connected'
    };
  }
  
  private setupRoomEventHandlers(): void {
    if (!this.room) return;
    
    // Handle incoming audio tracks
    this.room.on(RoomEvent.TrackSubscribed, async (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      if (track.kind === Track.Kind.Audio) {
        await this.handleIncomingAudio(track as RemoteAudioTrack);
      }
    });
    
    // Handle data messages
    this.room.on(RoomEvent.DataReceived, async (
      payload: Uint8Array,
      participant: RemoteParticipant,
      kind: DataPacket_Kind
    ) => {
      const data = JSON.parse(new TextDecoder().decode(payload));
      await this.handleDataMessage(data, participant);
    });
    
    // Handle participant events
    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log(`Participant connected: ${participant.identity}`);
    });
    
    this.room.on(RoomEvent.Disconnected, () => {
      console.log('Disconnected from room');
      this.cleanup();
    });
  }
  
  async startAudioStream(): Promise<LocalAudioTrack> {
    if (!this.room) throw new Error('Not connected to room');
    
    // Create local audio track with noise cancellation
    this.localAudioTrack = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 16000
    });
    
    // Publish to room
    await this.room.localParticipant.publishTrack(this.localAudioTrack);
    
    // Start processing pipeline
    this.startAudioProcessingPipeline();
    
    return this.localAudioTrack;
  }
  
  private async startAudioProcessingPipeline(): Promise<void> {
    if (!this.localAudioTrack) return;
    
    // Get audio stream
    const stream = this.localAudioTrack.mediaStreamTrack;
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(new MediaStream([stream]));
    
    // Create processor
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = async (event) => {
      const audioData = event.inputBuffer.getChannelData(0);
      
      // Process for transcription
      const processed = await this.audioProcessor.process(audioData);
      
      // Send to transcription service
      if (processed.hasVoiceActivity) {
        const transcript = await this.transcriptionService.transcribe(processed.data);
        
        if (transcript) {
          await this.sendTranscript(transcript);
        }
      }
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
  }
  
  async sendCommand(command: VoiceCommand): Promise<void> {
    if (!this.room) throw new Error('Not connected to room');
    
    const data = JSON.stringify({
      type: 'command',
      payload: command
    });
    
    await this.room.localParticipant.publishData(
      new TextEncoder().encode(data),
      DataPacket_Kind.RELIABLE
    );
  }
}
```

### 3. LiveKit Agent Integration

```typescript
import { Agent, JobContext, WorkerOptions } from '@livekit/agents';
import { STT, TTS, LLM } from '@livekit/agents-plugin';

class VoiceAgent extends Agent {
  private stt: STT.Service;
  private tts: TTS.Service;
  private llm: LLM.Service;
  private claudeIntegration: ClaudeIntegration;
  
  constructor() {
    super();
    
    // Initialize services
    this.stt = new STT.WhisperService({
      model: 'large-v3',
      language: 'en'
    });
    
    this.tts = new TTS.OpenAIService({
      model: 'tts-1-hd',
      voice: 'alloy'
    });
    
    this.claudeIntegration = new ClaudeIntegration();
  }
  
  async handleJob(context: JobContext): Promise<void> {
    // Connect to room
    await context.connect();
    
    // Start voice activity detection
    const vad = context.vad.start();
    
    // Process audio stream
    for await (const event of vad) {
      if (event.type === 'speech_started') {
        await this.handleSpeechStart(context);
      } else if (event.type === 'speech_ended') {
        await this.handleSpeechEnd(context, event.audio);
      }
    }
  }
  
  private async handleSpeechEnd(context: JobContext, audio: AudioData): Promise<void> {
    // Transcribe audio
    const transcript = await this.stt.transcribe(audio);
    
    // Send to Claude
    const response = await this.claudeIntegration.process({
      message: transcript.text,
      context: context.metadata
    });
    
    // Generate TTS response
    const audioResponse = await this.tts.synthesize(response.text);
    
    // Play audio response
    await context.playAudio(audioResponse);
    
    // Send data update
    await context.sendData({
      type: 'assistant_response',
      transcript: transcript.text,
      response: response.text,
      timestamp: Date.now()
    });
  }
}

// Agent worker setup
const worker = new WorkerOptions({
  agent: VoiceAgent,
  wsUrl: process.env.LIVEKIT_WS_URL,
  apiKey: process.env.LIVEKIT_API_KEY,
  apiSecret: process.env.LIVEKIT_API_SECRET
});

worker.run();
```

## LiveKit Infrastructure Configuration

### 1. LiveKit Server Deployment

```yaml
# docker-compose.yml for LiveKit
version: '3.8'

services:
  livekit-server:
    image: livekit/livekit-server:latest
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
    environment:
      - LIVEKIT_KEYS=${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}
      - LIVEKIT_WEBHOOK_URLS=${WEBHOOK_URL}
      - LIVEKIT_TURN_ENABLED=true
    volumes:
      - ./livekit.yaml:/livekit.yaml
    command: --config /livekit.yaml

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  egress:
    image: livekit/egress:latest
    environment:
      - EGRESS_CONFIG_FILE=/egress.yaml
    volumes:
      - ./egress.yaml:/egress.yaml
      - recordings:/recordings

volumes:
  redis-data:
  recordings:
```

### 2. LiveKit Configuration

```yaml
# livekit.yaml
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true

redis:
  address: redis:6379

turn:
  enabled: true
  domain: turn.example.com
  cert_file: /certs/turn.crt
  key_file: /certs/turn.key

webhook:
  api_key: ${WEBHOOK_API_KEY}
  urls:
    - ${WEBHOOK_URL}

room:
  auto_create: false
  empty_timeout: 300
  max_participants: 10

logging:
  level: info
  sample: true
```

## API Specifications with LiveKit

### WebSocket Events

```typescript
// LiveKit-specific events
enum LiveKitEvent {
  // Room events
  ROOM_CREATED = 'room_created',
  ROOM_DELETED = 'room_deleted',
  
  // Participant events
  PARTICIPANT_JOINED = 'participant_joined',
  PARTICIPANT_LEFT = 'participant_left',
  
  // Track events
  TRACK_PUBLISHED = 'track_published',
  TRACK_UNPUBLISHED = 'track_unpublished',
  
  // Data events
  DATA_RECEIVED = 'data_received',
  
  // Voice-specific events
  TRANSCRIPTION_READY = 'transcription_ready',
  COMMAND_RECOGNIZED = 'command_recognized',
  TTS_READY = 'tts_ready'
}

// Event payloads
interface TranscriptionEvent {
  type: LiveKitEvent.TRANSCRIPTION_READY;
  roomId: string;
  participantId: string;
  transcript: {
    text: string;
    confidence: number;
    language: string;
    timestamp: number;
  };
}

interface CommandEvent {
  type: LiveKitEvent.COMMAND_RECOGNIZED;
  roomId: string;
  command: {
    intent: string;
    entities: Record<string, any>;
    confidence: number;
  };
}
```

### REST API Endpoints

```yaml
/api/voice/livekit/rooms:
  post:
    summary: Create LiveKit room for voice session
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              userId:
                type: string
              config:
                type: object
                properties:
                  maxParticipants:
                    type: integer
                  emptyTimeout:
                    type: integer
                  metadata:
                    type: object
    responses:
      201:
        description: Room created
        content:
          application/json:
            schema:
              type: object
              properties:
                roomName:
                  type: string
                token:
                  type: string
                wsUrl:
                  type: string

/api/voice/livekit/token:
  post:
    summary: Generate LiveKit access token
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              roomName:
                type: string
              participantId:
                type: string
              permissions:
                type: object
    responses:
      200:
        description: Token generated
        content:
          application/json:
            schema:
              type: object
              properties:
                token:
                  type: string
                expiresAt:
                  type: integer
```

## Client Integration

### React Hook for LiveKit

```typescript
import { Room, RoomEvent, Track } from 'livekit-client';
import { useEffect, useState, useCallback } from 'react';

export function useLiveKitVoice(roomUrl: string, token: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null);
  
  useEffect(() => {
    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });
    
    room.on(RoomEvent.Connected, () => {
      setIsConnected(true);
      console.log('Connected to LiveKit room');
    });
    
    room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      const data = JSON.parse(new TextDecoder().decode(payload));
      if (data.type === 'transcription') {
        setTranscript(data.text);
      }
    });
    
    room.connect(roomUrl, token).then(() => {
      setRoom(room);
    });
    
    return () => {
      room.disconnect();
    };
  }, [roomUrl, token]);
  
  const startRecording = useCallback(async () => {
    if (!room) return;
    
    const track = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    });
    
    await room.localParticipant.publishTrack(track);
    setAudioTrack(track);
    setIsRecording(true);
  }, [room]);
  
  const stopRecording = useCallback(async () => {
    if (!audioTrack) return;
    
    room?.localParticipant.unpublishTrack(audioTrack);
    audioTrack.stop();
    setAudioTrack(null);
    setIsRecording(false);
  }, [room, audioTrack]);
  
  const sendCommand = useCallback(async (command: string) => {
    if (!room) return;
    
    const data = JSON.stringify({
      type: 'command',
      text: command,
      timestamp: Date.now()
    });
    
    await room.localParticipant.publishData(
      new TextEncoder().encode(data),
      DataPacket_Kind.RELIABLE
    );
  }, [room]);
  
  return {
    isConnected,
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    sendCommand
  };
}
```

### Voice UI Component

```tsx
import React from 'react';
import { useLiveKitVoice } from './hooks/useLiveKitVoice';

export const VoiceInterface: React.FC<{ token: string }> = ({ token }) => {
  const {
    isConnected,
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    sendCommand
  } = useLiveKitVoice(LIVEKIT_URL, token);
  
  return (
    <div className="voice-interface">
      <div className="status">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`record-button ${isRecording ? 'recording' : ''}`}
      >
        {isRecording ? '⏹️ Stop' : '🎙️ Record'}
      </button>
      
      <div className="transcript">
        {transcript || 'Start speaking...'}
      </div>
      
      <div className="commands">
        <button onClick={() => sendCommand('help')}>
          Get Help
        </button>
        <button onClick={() => sendCommand('clear')}>
          Clear Context
        </button>
      </div>
    </div>
  );
};
```

## Performance Optimizations with LiveKit

### 1. Adaptive Bitrate

```typescript
class AdaptiveBitrateController {
  private room: Room;
  private targetBitrate: number = 24000;
  
  adjustBitrate(networkQuality: number): void {
    if (networkQuality < 3) {
      // Poor network - reduce bitrate
      this.targetBitrate = 16000;
    } else if (networkQuality > 4) {
      // Good network - increase bitrate
      this.targetBitrate = 32000;
    }
    
    this.room.localParticipant.setTrackBitrate(this.targetBitrate);
  }
}
```

### 2. Connection Resilience

```typescript
class ConnectionManager {
  private room: Room;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  setupResilience(): void {
    this.room.on(RoomEvent.Reconnecting, () => {
      console.log('Reconnecting to LiveKit...');
      this.reconnectAttempts++;
    });
    
    this.room.on(RoomEvent.Reconnected, () => {
      console.log('Reconnected successfully');
      this.reconnectAttempts = 0;
    });
    
    this.room.on(RoomEvent.Disconnected, async (reason?: DisconnectReason) => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.attemptReconnect();
      } else {
        this.handlePermanentDisconnection();
      }
    });
  }
}
```

## Monitoring & Analytics

### LiveKit Metrics Collection

```typescript
interface LiveKitMetrics {
  roomMetrics: {
    participantCount: number;
    trackCount: number;
    dataRate: number;
  };
  qualityMetrics: {
    packetLoss: number;
    jitter: number;
    rtt: number;
  };
  audioMetrics: {
    level: number;
    qualityScore: number;
  };
}

class LiveKitMonitor {
  collectMetrics(room: Room): LiveKitMetrics {
    const participants = room.participants;
    const localParticipant = room.localParticipant;
    
    return {
      roomMetrics: {
        participantCount: participants.size,
        trackCount: this.countTracks(participants),
        dataRate: this.calculateDataRate(localParticipant)
      },
      qualityMetrics: {
        packetLoss: room.stats.packetLoss,
        jitter: room.stats.jitter,
        rtt: room.stats.rtt
      },
      audioMetrics: {
        level: this.getAudioLevel(localParticipant),
        qualityScore: this.calculateQualityScore(room.stats)
      }
    };
  }
}
```

## Security with LiveKit

### Token-based Authentication

```typescript
class LiveKitSecurity {
  generateSecureToken(
    userId: string,
    roomName: string,
    permissions: Permissions
  ): string {
    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: userId,
      ttl: '2h',
      metadata: JSON.stringify({
        userId,
        timestamp: Date.now()
      })
    });
    
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: permissions.canPublish,
      canSubscribe: permissions.canSubscribe,
      canPublishData: true,
      hidden: false,
      recorder: false
    });
    
    return at.toJwt();
  }
}
```

## Conclusion

The LiveKit-based Voice Mode architecture provides:

1. **Scalable WebRTC Infrastructure**: Production-ready real-time communication
2. **Low Latency**: Sub-100ms audio streaming with global distribution
3. **Built-in Resilience**: Automatic reconnection and adaptive quality
4. **Easy Integration**: SDKs for web, mobile, and server
5. **Advanced Features**: Recording, transcription, and AI agent support

This design leverages LiveKit's proven infrastructure while maintaining flexibility for custom voice processing and Claude integration.