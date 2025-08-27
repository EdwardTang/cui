# Voice Mode Integration Documentation

## Overview

Voice Mode transforms CUI Server into a voice-first development assistant, enabling natural language interactions with Claude through speech recognition and synthesis. This integration provides hands-free coding, real-time transcription, and audio feedback for a seamless development experience.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Voice Mode Pipeline                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐ │
│  │  Audio   │───▶│  Speech  │───▶│  Claude  │───▶│  TTS   │ │
│  │  Capture │    │Recognition│    │Processing│    │ Output │ │
│  └──────────┘    └──────────┘    └──────────┘    └────────┘ │
│       ▲               │               │               │       │
│       │               ▼               ▼               ▼       │
│  [Web Audio]    [Transcription]  [AI Response]  [Audio Stream]│
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. VoiceModeService
**Location**: `src/services/voice-mode-service.ts`

```typescript
export class VoiceModeService {
  private audioProcessor: AudioProcessor;
  private speechRecognizer: SpeechRecognizer;
  private voiceSynthesizer: VoiceSynthesizer;
  private conversationManager: ConversationManager;

  async startVoiceSession(conversationId: string): Promise<VoiceSession>
  async processAudioStream(stream: ReadableStream): Promise<Transcription>
  async synthesizeResponse(text: string): Promise<AudioBuffer>
  async endVoiceSession(sessionId: string): Promise<void>
}
```

### 2. Audio Recording Hook
**Location**: `src/web/chat/hooks/useAudioRecording.ts`

```typescript
export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  
  const startRecording = async (): Promise<void>
  const stopRecording = async (): Promise<Blob>
  const cancelRecording = (): void
  
  return {
    isRecording,
    audioData,
    transcription,
    startRecording,
    stopRecording,
    cancelRecording
  };
}
```

### 3. Waveform Visualizer
**Location**: `src/web/chat/components/WaveformVisualizer/`

```typescript
interface WaveformVisualizerProps {
  audioData: Float32Array;
  isActive: boolean;
  color?: string;
  height?: number;
  width?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps>
```

## Implementation Details

### Audio Capture

#### Browser API Integration
```javascript
// Web Audio API setup
const audioContext = new AudioContext();
const mediaStream = await navigator.mediaDevices.getUserMedia({ 
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
});

const source = audioContext.createMediaStreamSource(mediaStream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

source.connect(processor);
processor.connect(audioContext.destination);

processor.onaudioprocess = (event) => {
  const audioData = event.inputBuffer.getChannelData(0);
  // Process audio data
};
```

#### Audio Format Specifications
- **Sample Rate**: 16kHz or 48kHz
- **Bit Depth**: 16-bit PCM
- **Channels**: Mono
- **Format**: WAV or WebM
- **Compression**: Opus codec for WebM

### Speech Recognition

#### Recognition Pipeline
1. **Audio Preprocessing**
   - Noise reduction
   - Voice activity detection (VAD)
   - Audio normalization

2. **Speech-to-Text**
   - Real-time streaming recognition
   - Language detection
   - Punctuation restoration

3. **Post-processing**
   - Intent classification
   - Command extraction
   - Context preservation

#### Supported Languages
```typescript
const SUPPORTED_LANGUAGES = [
  'en-US', // English (US)
  'en-GB', // English (UK)
  'es-ES', // Spanish
  'fr-FR', // French
  'de-DE', // German
  'ja-JP', // Japanese
  'zh-CN', // Chinese (Simplified)
  'ko-KR', // Korean
];
```

### Voice Synthesis

#### TTS Configuration
```typescript
interface TTSConfig {
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model: 'tts-1' | 'tts-1-hd';
  speed: number; // 0.25 to 4.0
  language: string;
}

const defaultTTSConfig: TTSConfig = {
  voice: 'alloy',
  model: 'tts-1',
  speed: 1.0,
  language: 'en-US'
};
```

#### Audio Playback
```javascript
// Audio playback implementation
const audioElement = new Audio();
audioElement.src = URL.createObjectURL(audioBlob);
audioElement.playbackRate = config.speed;

// With Web Audio API for advanced control
const audioContext = new AudioContext();
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.playbackRate.value = config.speed;
source.connect(audioContext.destination);
source.start();
```

## Voice Commands

### Command Structure
```typescript
interface VoiceCommand {
  trigger: string | RegExp;
  action: string;
  parameters?: Record<string, any>;
  requiresConfirmation?: boolean;
}
```

### Built-in Commands

#### Development Commands
- "Write a function to [description]"
- "Create a component called [name]"
- "Add a test for [function/component]"
- "Refactor this [code/function/component]"

#### Navigation Commands
- "Go to line [number]"
- "Open file [filename]"
- "Search for [term]"
- "Show me [component/function] definition"

#### Execution Commands
- "Run the tests"
- "Build the project"
- "Start the development server"
- "Deploy to [environment]"

#### Documentation Commands
- "Explain this code"
- "Add comments to this function"
- "Generate documentation for [component]"
- "What does this error mean?"

### Custom Command Registration
```typescript
// Register custom voice commands
voiceModeService.registerCommand({
  trigger: /deploy to (production|staging|development)/i,
  action: 'deploy',
  parameters: (match) => ({
    environment: match[1]
  }),
  requiresConfirmation: true
});
```

## Integration Points

### 1. Claude Process Manager Integration
```typescript
// Voice message handling
class ClaudeProcessManager {
  async sendVoiceMessage(
    conversationId: string, 
    audioData: Blob
  ): Promise<void> {
    const transcription = await this.transcribeAudio(audioData);
    await this.sendMessage(conversationId, transcription, {
      metadata: { source: 'voice' }
    });
  }
}
```

### 2. Stream Manager Integration
```typescript
// Voice response streaming
class StreamManager {
  async streamVoiceResponse(
    conversationId: string,
    response: string
  ): Promise<void> {
    const audioStream = await this.synthesizeAudio(response);
    this.emit('voice:response', {
      conversationId,
      audioStream,
      text: response
    });
  }
}
```

### 3. Permission System Integration
```typescript
// Voice permission requests
interface VoicePermissionRequest {
  type: 'voice_command';
  command: string;
  action: string;
  requiresConfirmation: boolean;
}

// Verbal confirmation handling
async function handleVoiceConfirmation(
  request: VoicePermissionRequest
): Promise<boolean> {
  const response = await captureVoiceResponse();
  return parseConfirmation(response);
}
```

## UI Components

### Voice Control Panel
```tsx
export const VoiceControlPanel: React.FC = () => {
  const { isRecording, startRecording, stopRecording } = useAudioRecording();
  const [isListening, setIsListening] = useState(false);
  
  return (
    <div className="voice-control-panel">
      <button 
        onClick={isRecording ? stopRecording : startRecording}
        className={`mic-button ${isRecording ? 'active' : ''}`}
      >
        {isRecording ? <MicOff /> : <Mic />}
      </button>
      
      <WaveformVisualizer 
        isActive={isRecording}
        audioData={audioData}
      />
      
      <TranscriptionDisplay 
        text={transcription}
        isProcessing={isProcessing}
      />
    </div>
  );
};
```

### Voice Settings
```tsx
interface VoiceSettings {
  enabled: boolean;
  autoListen: boolean;
  voice: string;
  speed: number;
  volume: number;
  language: string;
  wakeWord: string;
}

export const VoiceSettingsPanel: React.FC = () => {
  // Settings UI implementation
};
```

## Configuration

### Environment Variables
```bash
# Voice Mode Configuration
VOICE_MODE_ENABLED=true
VOICE_API_ENDPOINT=https://api.openai.com/v1/audio
VOICE_API_KEY=sk-...
VOICE_MODEL=whisper-1
TTS_MODEL=tts-1
TTS_VOICE=alloy

# Audio Configuration
AUDIO_SAMPLE_RATE=16000
AUDIO_CHANNELS=1
AUDIO_FORMAT=wav

# Recognition Settings
VOICE_LANGUAGE=en-US
VOICE_CONFIDENCE_THRESHOLD=0.8
VOICE_SILENCE_DURATION=2000
VOICE_MAX_RECORDING_TIME=60000
```

### User Preferences
```json
{
  "voiceMode": {
    "enabled": true,
    "autoStart": false,
    "wakeWord": "Hey Claude",
    "voice": {
      "type": "alloy",
      "speed": 1.0,
      "pitch": 1.0
    },
    "recognition": {
      "language": "en-US",
      "continuous": true,
      "interimResults": true
    },
    "ui": {
      "showTranscription": true,
      "showWaveform": true,
      "compactMode": false
    }
  }
}
```

## Performance Optimization

### Audio Processing
1. **Client-side compression** before sending to server
2. **Chunked streaming** for real-time processing
3. **Audio caching** for frequently used responses
4. **Background processing** using Web Workers

### Network Optimization
```typescript
// Efficient audio streaming
class AudioStreamOptimizer {
  private chunkSize = 4096;
  private compressionRatio = 0.5;
  
  async* streamAudio(audioData: ArrayBuffer): AsyncGenerator<Uint8Array> {
    const compressed = await this.compress(audioData);
    
    for (let i = 0; i < compressed.byteLength; i += this.chunkSize) {
      yield new Uint8Array(
        compressed.slice(i, Math.min(i + this.chunkSize, compressed.byteLength))
      );
    }
  }
}
```

### Caching Strategy
```typescript
// Voice response caching
class VoiceResponseCache {
  private cache = new Map<string, AudioBuffer>();
  private maxSize = 50; // MB
  
  async get(text: string): Promise<AudioBuffer | null> {
    const key = this.generateKey(text);
    return this.cache.get(key) || null;
  }
  
  async set(text: string, audio: AudioBuffer): Promise<void> {
    if (this.getCurrentSize() + audio.byteLength > this.maxSize * 1024 * 1024) {
      this.evictOldest();
    }
    this.cache.set(this.generateKey(text), audio);
  }
}
```

## Error Handling

### Common Issues and Solutions

#### Microphone Access Denied
```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // Show permission request UI
    showMicrophonePermissionDialog();
  } else if (error.name === 'NotFoundError') {
    // No microphone available
    showNoMicrophoneError();
  }
}
```

#### Audio Context Suspension
```typescript
// Resume audio context on user interaction
document.addEventListener('click', async () => {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
});
```

#### Network Interruptions
```typescript
class VoiceConnectionManager {
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  
  async handleDisconnection(): Promise<void> {
    if (this.reconnectAttempts < this.maxReconnects) {
      await this.reconnect();
      this.reconnectAttempts++;
    } else {
      this.fallbackToText();
    }
  }
}
```

## Testing

### Unit Tests
```typescript
describe('VoiceModeService', () => {
  it('should transcribe audio correctly', async () => {
    const audioBlob = createMockAudioBlob();
    const transcription = await service.transcribeAudio(audioBlob);
    expect(transcription).toBe('Hello Claude');
  });
  
  it('should handle voice commands', async () => {
    const command = 'Write a function to calculate factorial';
    const result = await service.processVoiceCommand(command);
    expect(result.action).toBe('write_code');
  });
});
```

### Integration Tests
```typescript
describe('Voice Mode Integration', () => {
  it('should complete voice conversation flow', async () => {
    // Start recording
    await voiceMode.startRecording();
    
    // Simulate speech
    await simulateSpeech('Create a React component');
    
    // Stop and process
    const result = await voiceMode.stopAndProcess();
    
    // Verify response
    expect(result.transcription).toContain('React component');
    expect(result.response).toContain('function Component');
  });
});
```

## Security Considerations

### Audio Data Privacy
1. **Encryption**: All audio data encrypted in transit (TLS)
2. **Storage**: No permanent audio storage without consent
3. **Processing**: Audio processed in memory only
4. **Deletion**: Automatic cleanup after processing

### Permission Management
```typescript
interface VoicePermissions {
  microphone: boolean;
  speaker: boolean;
  continuousListening: boolean;
  audioStorage: boolean;
}

class VoicePermissionManager {
  async requestPermissions(): Promise<VoicePermissions>
  async checkPermissions(): Promise<VoicePermissions>
  async revokePermissions(): Promise<void>
}
```

## Future Enhancements

### Planned Features
1. **Multi-language support** with automatic language detection
2. **Voice biometrics** for user identification
3. **Offline mode** with local speech recognition
4. **Voice macros** for complex command sequences
5. **Emotion detection** for context-aware responses
6. **Custom wake words** training
7. **Voice shortcuts** for frequently used commands
8. **Collaborative voice sessions** with multiple users

### Research Areas
- Advanced noise cancellation algorithms
- Real-time voice translation
- Context-aware command prediction
- Voice-driven code navigation
- Ambient computing integration

## Resources

### Documentation
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaStream Recording API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API)
- [Speech Recognition API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)

### Libraries and Tools
- [Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [TTS API](https://platform.openai.com/docs/guides/text-to-speech)
- [WaveSurfer.js](https://wavesurfer-js.org/) - Audio waveform visualization
- [RecordRTC](https://recordrtc.org/) - Cross-browser audio recording