# Test-Driven Development Guide for Voice Mode

## Overview

This guide establishes TDD practices for Voice Mode implementation, ensuring high quality, maintainable code with comprehensive test coverage.

## TDD Principles

### Core Philosophy (Enhanced with Research Phase)
1. **Research**: Gather best practices and patterns before writing tests
2. **Red**: Write a failing test first
3. **Green**: Write minimal code to pass the test  
4. **Refactor**: Improve code while keeping tests green
5. **Validate**: Ensure coverage meets thresholds and quality gates

### Enhanced TDD Workflow

#### Research Phase (Mandatory for all tasks)
When a task status is set to `in-progress`, **research phase must be executed first**:

```typescript
// Automated research workflow
interface ResearchPhase {
  sources: {
    context7: 'Official documentation and patterns',
    deepWiki: 'Technical concepts and implementation details',
    exaResearch: 'Industry practices and real-world examples'
  };
  
  outputs: {
    bestPractices: string[];
    performanceConsiderations: string[];
    securityConcerns: string[];
    testStrategies: string[];
    riskAssessment: string[];
  };
}

// Research triggers automatically when task begins
async function onTaskStart(taskId: string): Promise<void> {
  const research = await conductResearch({
    parallel: true,
    sources: ['context7', 'deepWiki', 'exaResearch']
  });
  
  await recordFindings(taskId, research);
  await generateTestStrategy(research);
}
```

### Testing Pyramid
```
         /\
        /  \  E2E Tests (10%)
       /────\
      /      \  Integration Tests (30%)
     /────────\
    /          \  Unit Tests (60%)
   /────────────\
```

## Test Structure

### Naming Conventions
```typescript
// Test file naming
ComponentName.test.ts       // Unit tests
ComponentName.int.test.ts   // Integration tests
ComponentName.e2e.test.ts   // End-to-end tests

// Test naming pattern
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
  });
});
```

### Test Organization
```
tests/
├── unit/
│   ├── services/
│   │   ├── LiveKitRoomService.test.ts
│   │   ├── VoiceSessionController.test.ts
│   │   └── AudioProcessor.test.ts
│   ├── components/
│   │   ├── VoiceInterface.test.tsx
│   │   └── WaveformVisualizer.test.tsx
│   └── hooks/
│       └── useLiveKitVoice.test.ts
├── integration/
│   ├── voice-pipeline.int.test.ts
│   ├── stt-tts-flow.int.test.ts
│   └── claude-integration.int.test.ts
├── e2e/
│   ├── voice-session.e2e.test.ts
│   └── command-execution.e2e.test.ts
├── fixtures/
│   ├── audio/
│   ├── transcripts/
│   └── responses/
└── helpers/
    ├── mockFactories.ts
    ├── testUtils.ts
    └── assertions.ts
```

## Unit Testing Patterns

### Service Testing

```typescript
// LiveKitRoomService.test.ts
import { LiveKitRoomService } from '@/services/LiveKitRoomService';
import { RoomServiceClient } from 'livekit-server-sdk';

jest.mock('livekit-server-sdk');

describe('LiveKitRoomService', () => {
  let service: LiveKitRoomService;
  let mockClient: jest.Mocked<RoomServiceClient>;
  
  beforeEach(() => {
    mockClient = new RoomServiceClient() as jest.Mocked<RoomServiceClient>;
    service = new LiveKitRoomService({
      host: 'http://localhost:7880',
      apiKey: 'test-key',
      apiSecret: 'test-secret'
    });
  });
  
  describe('createRoom', () => {
    it('should create a room with correct configuration', async () => {
      // Arrange
      const roomName = 'test-room';
      const expectedRoom = { name: roomName, sid: 'room-123' };
      mockClient.createRoom.mockResolvedValue(expectedRoom);
      
      // Act
      const room = await service.createRoom(roomName, {
        maxParticipants: 2,
        emptyTimeout: 300
      });
      
      // Assert
      expect(mockClient.createRoom).toHaveBeenCalledWith({
        name: roomName,
        maxParticipants: 2,
        emptyTimeout: 300,
        metadata: expect.stringContaining('voice_session')
      });
      expect(room).toEqual(expectedRoom);
    });
    
    it('should throw error when room creation fails', async () => {
      // Arrange
      mockClient.createRoom.mockRejectedValue(new Error('API Error'));
      
      // Act & Assert
      await expect(service.createRoom('test-room')).rejects.toThrow('API Error');
    });
  });
  
  describe('generateToken', () => {
    it('should generate valid access token with permissions', async () => {
      // Test token generation logic
      const token = await service.generateToken('room-1', 'user-1', {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true
      });
      
      // Decode and verify token
      const decoded = jwt.decode(token);
      expect(decoded.video.roomJoin).toBe(true);
      expect(decoded.video.room).toBe('room-1');
    });
  });
});
```

### Audio Processing Testing

```typescript
// AudioProcessor.test.ts
describe('AudioProcessor', () => {
  let processor: AudioProcessor;
  let mockVAD: jest.Mocked<VoiceActivityDetector>;
  
  beforeEach(() => {
    mockVAD = createMockVAD();
    processor = new AudioProcessor({ vadDetector: mockVAD });
  });
  
  describe('processChunk', () => {
    it('should apply noise reduction to audio chunk', async () => {
      // Arrange
      const inputAudio = generateWhiteNoise(4096);
      const expectedSNR = 20; // dB
      
      // Act
      const processed = await processor.processChunk(inputAudio);
      
      // Assert
      const snr = calculateSNR(inputAudio, processed.data);
      expect(snr).toBeGreaterThan(expectedSNR);
    });
    
    it('should detect voice activity correctly', async () => {
      // Arrange
      const speechAudio = loadFixture('speech-sample.wav');
      mockVAD.detect.mockReturnValue({ hasVoice: true, confidence: 0.95 });
      
      // Act
      const result = await processor.processChunk(speechAudio);
      
      // Assert
      expect(result.metadata.vadState.hasVoice).toBe(true);
      expect(result.metadata.vadState.confidence).toBeGreaterThan(0.9);
    });
    
    it('should maintain audio quality after processing', async () => {
      // Arrange
      const originalAudio = loadFixture('high-quality-speech.wav');
      
      // Act
      const processed = await processor.processChunk(originalAudio);
      
      // Assert - PESQ score for audio quality
      const pesqScore = calculatePESQ(originalAudio, processed.data);
      expect(pesqScore).toBeGreaterThan(4.0); // Excellent quality
    });
  });
});
```

### React Component Testing

```typescript
// VoiceInterface.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoiceInterface } from '@/components/VoiceInterface';
import { useLiveKitVoice } from '@/hooks/useLiveKitVoice';

jest.mock('@/hooks/useLiveKitVoice');

describe('VoiceInterface', () => {
  const mockUseLiveKitVoice = useLiveKitVoice as jest.MockedFunction<typeof useLiveKitVoice>;
  
  beforeEach(() => {
    mockUseLiveKitVoice.mockReturnValue({
      isConnected: true,
      isRecording: false,
      transcript: '',
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      sendCommand: jest.fn()
    });
  });
  
  it('should render connection status correctly', () => {
    render(<VoiceInterface token="test-token" />);
    
    expect(screen.getByText('🟢 Connected')).toBeInTheDocument();
  });
  
  it('should start recording when button clicked', async () => {
    const startRecording = jest.fn();
    mockUseLiveKitVoice.mockReturnValue({
      ...mockUseLiveKitVoice(),
      startRecording
    });
    
    render(<VoiceInterface token="test-token" />);
    
    const recordButton = screen.getByRole('button', { name: /record/i });
    fireEvent.click(recordButton);
    
    await waitFor(() => {
      expect(startRecording).toHaveBeenCalled();
    });
  });
  
  it('should display transcript in real-time', () => {
    const transcript = 'Hello, this is a test transcript';
    mockUseLiveKitVoice.mockReturnValue({
      ...mockUseLiveKitVoice(),
      transcript
    });
    
    render(<VoiceInterface token="test-token" />);
    
    expect(screen.getByText(transcript)).toBeInTheDocument();
  });
});
```

## Integration Testing Patterns

### Voice Pipeline Integration

```typescript
// voice-pipeline.int.test.ts
describe('Voice Pipeline Integration', () => {
  let liveKitServer: LiveKitTestServer;
  let voiceService: VoiceService;
  let sttService: STTService;
  let ttsService: TTSService;
  
  beforeAll(async () => {
    // Start test LiveKit server
    liveKitServer = await LiveKitTestServer.start();
    
    // Initialize services
    voiceService = new VoiceService({
      liveKitUrl: liveKitServer.url
    });
    sttService = new STTService({ provider: 'mock' });
    ttsService = new TTSService({ provider: 'mock' });
  });
  
  afterAll(async () => {
    await liveKitServer.stop();
  });
  
  it('should complete audio processing pipeline', async () => {
    // Arrange
    const testAudio = loadFixture('test-speech.wav');
    const expectedTranscript = 'Hello world';
    
    // Act
    const session = await voiceService.createSession('user-1');
    const audioTrack = await session.publishAudioTrack(testAudio);
    
    // Wait for processing
    const transcript = await waitForTranscript(session, 5000);
    
    // Assert
    expect(transcript.text).toBe(expectedTranscript);
    expect(transcript.confidence).toBeGreaterThan(0.9);
  });
  
  it('should handle STT to TTS flow', async () => {
    // Arrange
    const inputText = 'What is the weather today?';
    const expectedResponse = 'The weather is sunny';
    
    // Act
    const session = await voiceService.createSession('user-1');
    await session.sendTranscript(inputText);
    
    const audioResponse = await waitForAudioResponse(session, 10000);
    
    // Assert
    expect(audioResponse).toBeDefined();
    expect(audioResponse.text).toBe(expectedResponse);
    expect(audioResponse.audio.byteLength).toBeGreaterThan(0);
  });
});
```

### Claude Integration Testing

```typescript
// claude-integration.int.test.ts
describe('Claude Integration', () => {
  let claudeService: ClaudeService;
  let voiceController: VoiceController;
  
  beforeEach(() => {
    claudeService = new ClaudeService({ 
      apiKey: process.env.CLAUDE_TEST_KEY 
    });
    voiceController = new VoiceController({ claudeService });
  });
  
  it('should process voice command through Claude', async () => {
    // Arrange
    const command = {
      text: 'Create a React component called Button',
      intent: 'code_generation',
      confidence: 0.95
    };
    
    // Act
    const response = await voiceController.processCommand(command);
    
    // Assert
    expect(response.success).toBe(true);
    expect(response.result).toContain('export const Button');
    expect(response.result).toContain('React.FC');
  });
  
  it('should maintain conversation context', async () => {
    // Arrange
    const session = await voiceController.createSession('user-1');
    
    // Act - First message
    await session.sendMessage('My name is Alice');
    
    // Act - Second message referencing context
    const response = await session.sendMessage('What is my name?');
    
    // Assert
    expect(response.text).toContain('Alice');
  });
});
```

## E2E Testing Patterns

### Voice Session E2E

```typescript
// voice-session.e2e.test.ts
import { Browser, Page } from 'playwright';

describe('Voice Session E2E', () => {
  let browser: Browser;
  let page: Page;
  
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3001');
    
    // Grant microphone permissions
    await page.context().grantPermissions(['microphone']);
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  it('should complete full voice interaction flow', async () => {
    // Navigate to voice interface
    await page.click('[data-testid="voice-mode-button"]');
    
    // Start recording
    await page.click('[data-testid="record-button"]');
    
    // Simulate speech (inject audio)
    await page.evaluate(() => {
      // Inject test audio stream
      window.testAudioInjector.injectAudio('hello-world.wav');
    });
    
    // Wait for transcript
    await page.waitForSelector('[data-testid="transcript"]', {
      state: 'visible',
      timeout: 5000
    });
    
    const transcript = await page.textContent('[data-testid="transcript"]');
    expect(transcript).toBe('Hello world');
    
    // Wait for response
    await page.waitForSelector('[data-testid="response"]', {
      state: 'visible',
      timeout: 10000
    });
    
    const response = await page.textContent('[data-testid="response"]');
    expect(response).toContain('Hello! How can I help');
    
    // Verify audio playback started
    const isPlaying = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio && !audio.paused;
    });
    expect(isPlaying).toBe(true);
  });
});
```

## Mock Strategies

### Mock Factories

```typescript
// helpers/mockFactories.ts
export function createMockLiveKitRoom(): MockRoom {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    localParticipant: createMockParticipant(),
    participants: new Map(),
    on: jest.fn(),
    off: jest.fn(),
    state: 'connected'
  };
}

export function createMockAudioTrack(): MockAudioTrack {
  return {
    kind: Track.Kind.Audio,
    source: Track.Source.Microphone,
    mediaStreamTrack: createMockMediaStreamTrack(),
    stop: jest.fn(),
    mute: jest.fn(),
    unmute: jest.fn()
  };
}

export function createMockSTTService(): MockSTTService {
  return {
    transcribe: jest.fn().mockResolvedValue({
      text: 'Default transcript',
      confidence: 0.95,
      language: 'en-US'
    }),
    createTranscriber: jest.fn().mockReturnValue(
      new MockStreamTranscriber()
    )
  };
}
```

### Test Utilities

```typescript
// helpers/testUtils.ts
export async function waitForTranscript(
  session: VoiceSession,
  timeout: number = 5000
): Promise<Transcript> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Transcript timeout'));
    }, timeout);
    
    session.on('transcript', (transcript) => {
      clearTimeout(timer);
      resolve(transcript);
    });
  });
}

export function generateTestAudio(
  duration: number,
  sampleRate: number = 16000
): Float32Array {
  const samples = duration * sampleRate;
  const audio = new Float32Array(samples);
  
  // Generate sine wave
  for (let i = 0; i < samples; i++) {
    audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
  }
  
  return audio;
}

export function loadAudioFixture(filename: string): ArrayBuffer {
  const filepath = path.join(__dirname, '../fixtures/audio', filename);
  return fs.readFileSync(filepath).buffer;
}
```

## Test Coverage Requirements

### Coverage Targets
- **Overall**: 80% minimum
- **Critical paths**: 95% minimum
- **New code**: 90% minimum

### Coverage Configuration

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        '*.d.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
});
```

## Performance Testing

### Latency Testing

```typescript
describe('Performance: Latency', () => {
  it('should maintain STT latency under 100ms', async () => {
    const iterations = 100;
    const latencies: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const audio = generateTestAudio(1); // 1 second
      
      const start = performance.now();
      await sttService.transcribe(audio);
      const end = performance.now();
      
      latencies.push(end - start);
    }
    
    const p99 = calculatePercentile(latencies, 99);
    expect(p99).toBeLessThan(100);
  });
  
  it('should maintain E2E latency under 200ms', async () => {
    const session = await createTestSession();
    
    const start = performance.now();
    await session.processAudioChunk(testAudioChunk);
    const response = await session.waitForResponse();
    const end = performance.now();
    
    expect(end - start).toBeLessThan(200);
  });
});
```

### Load Testing

```typescript
describe('Performance: Load', () => {
  it('should handle 100 concurrent sessions', async () => {
    const sessions: VoiceSession[] = [];
    
    // Create sessions
    for (let i = 0; i < 100; i++) {
      const session = await voiceService.createSession(`user-${i}`);
      sessions.push(session);
    }
    
    // Send audio to all sessions
    const promises = sessions.map(session => 
      session.processAudio(testAudio)
    );
    
    // Assert all complete successfully
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled');
    
    expect(successful.length).toBe(100);
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linting
        run: npm run lint
        
      - name: Run type checking
        run: npm run typecheck
        
      - name: Run unit tests
        run: npm run test:unit
        
      - name: Run integration tests
        run: npm run test:integration
        
      - name: Generate coverage report
        run: npm run test:coverage
        
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Performance tests
        if: github.event_name == 'pull_request'
        run: npm run test:performance
```

## Best Practices

### Test Writing Guidelines

1. **Arrange-Act-Assert Pattern**
   ```typescript
   it('should do something', () => {
     // Arrange - Set up test data and mocks
     const input = createTestData();
     
     // Act - Execute the code under test
     const result = functionUnderTest(input);
     
     // Assert - Verify the results
     expect(result).toEqual(expectedOutput);
   });
   ```

2. **One Assertion Per Test**
   - Keep tests focused on single behavior
   - Multiple assertions only when testing related properties

3. **Descriptive Test Names**
   - Use "should" pattern
   - Include condition and expected outcome

4. **Test Isolation**
   - No shared state between tests
   - Clean up after each test
   - Use beforeEach/afterEach appropriately

5. **Mock External Dependencies**
   - Mock network calls
   - Mock file system operations
   - Mock time-dependent operations

### Common Testing Patterns

1. **Testing Async Code**
   ```typescript
   it('should handle async operations', async () => {
     const result = await asyncFunction();
     expect(result).toBeDefined();
   });
   ```

2. **Testing Errors**
   ```typescript
   it('should throw error for invalid input', async () => {
     await expect(functionThatThrows()).rejects.toThrow('Expected error');
   });
   ```

3. **Testing Events**
   ```typescript
   it('should emit events', (done) => {
     emitter.on('event', (data) => {
       expect(data).toBe('expected');
       done();
     });
     
     emitter.triggerEvent();
   });
   ```

4. **Testing Timeouts**
   ```typescript
   it('should timeout after delay', async () => {
     jest.useFakeTimers();
     
     const promise = functionWithTimeout();
     jest.advanceTimersByTime(5000);
     
     await expect(promise).rejects.toThrow('Timeout');
   });
   ```

## Debugging Tests

### Debugging Strategies

1. **Verbose Logging**
   ```bash
   npm test -- --verbose
   ```

2. **Single Test Execution**
   ```bash
   npm test -- --testNamePattern="should create room"
   ```

3. **Debug Mode**
   ```bash
   node --inspect-brk ./node_modules/.bin/vitest
   ```

4. **Console Debugging**
   ```typescript
   it('debugging test', () => {
     console.log('Current state:', state);
     debugger; // Breakpoint for debugger
   });
   ```

## Golden Samples and Contract Testing

### Golden Sample Management

```typescript
// Golden sample structure for Voice Mode
interface GoldenSample {
  id: string;
  category: 'audio' | 'transcript' | 'command' | 'response';
  input: any;
  expectedOutput: any;
  metadata: {
    createdAt: Date;
    validatedBy: string[];
    performance: {
      latency: number;
      accuracy: number;
    };
  };
}

// Golden sample validator
class GoldenSampleValidator {
  async validate(actual: any, golden: GoldenSample): Promise<ValidationResult> {
    const diffs = this.compareOutputs(actual, golden.expectedOutput);
    
    return {
      valid: diffs.length === 0,
      diffs,
      performanceMetrics: this.comparePerformance(actual, golden)
    };
  }
}
```

### Contract Testing for LiveKit Integration

```typescript
// LiveKit contract tests
describe('LiveKit Contract Tests', () => {
  it('should maintain room creation contract', async () => {
    const contract = loadContract('livekit-room-creation.json');
    
    const response = await livekitService.createRoom({
      name: 'test-room',
      maxParticipants: 2
    });
    
    expect(response).toMatchContract(contract);
  });
});
```

## Table-Driven Testing (Enhanced)

### Unified Test Case Structure

```typescript
// Generic test case with setup/teardown
interface TestCase<I, O> {
  name: string;
  input: I;
  want: O;
  wantErr?: Error;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

// Test runner with parallel execution support
class TestRunner<I, O> {
  async runTable(
    cases: TestCase<I, O>[],
    fn: (input: I) => Promise<O>,
    options?: { parallel?: boolean }
  ): Promise<TestResults> {
    const executor = options?.parallel 
      ? this.runParallel 
      : this.runSequential;
      
    return executor(cases, fn);
  }
  
  private async runParallel(
    cases: TestCase<I, O>[],
    fn: (input: I) => Promise<O>
  ): Promise<TestResults> {
    return Promise.all(
      cases.map(tc => this.runSingleCase(tc, fn))
    );
  }
}
```

## Property-Based Testing

### Voice Mode Property Tests

```typescript
import { fc } from 'fast-check';

describe('Voice Mode Properties', () => {
  it('should maintain audio quality through pipeline', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1000, maxLength: 10000 }),
        async (audioData) => {
          const processed = await audioProcessor.process(audioData);
          
          // Properties that must hold
          expect(processed.length).toBeLessThanOrEqual(audioData.length * 1.1);
          expect(calculateSNR(processed)).toBeGreaterThan(20);
          expect(detectClipping(processed)).toBe(false);
        }
      )
    );
  });
  
  it('should handle concurrent sessions without interference', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 2, maxLength: 10 }),
        async (sessionIds) => {
          const sessions = await Promise.all(
            sessionIds.map(id => voiceService.createSession(id))
          );
          
          // Each session should be independent
          for (const session of sessions) {
            const otherSessions = sessions.filter(s => s.id !== session.id);
            expect(session.getState()).not.toBeAffectedBy(otherSessions);
          }
        }
      )
    );
  });
});
```

## Mutation Testing

### Mutation Testing Configuration

```javascript
// stryker.conf.js
module.exports = {
  mutate: [
    'src/services/**/*.ts',
    '!src/**/*.test.ts'
  ],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 90,
    low: 80,
    break: 75
  },
  mutator: {
    excludedMutations: ['LogicalOperator']
  }
};
```

## Snapshot Testing for Voice Interactions

```typescript
describe('Voice Interaction Snapshots', () => {
  it('should match conversation flow snapshot', async () => {
    const conversation = await simulateConversation([
      { type: 'audio', data: loadAudioFixture('greeting.wav') },
      { type: 'command', data: 'create a button component' },
      { type: 'audio', data: loadAudioFixture('thank-you.wav') }
    ]);
    
    expect(conversation.toJSON()).toMatchSnapshot();
  });
});
```

## Security Testing

### Security Test Suite

```typescript
describe('Voice Mode Security', () => {
  describe('Input Sanitization', () => {
    it('should reject malicious audio payloads', async () => {
      const maliciousPayloads = [
        createOversizedAudio(100 * 1024 * 1024), // 100MB
        createMalformedWAV(),
        createAudioWithEmbeddedScript()
      ];
      
      for (const payload of maliciousPayloads) {
        await expect(
          audioProcessor.process(payload)
        ).rejects.toThrow(SecurityError);
      }
    });
  });
  
  describe('Command Injection Prevention', () => {
    it('should sanitize voice commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        '"; DROP TABLE users; --',
        '../../../etc/passwd'
      ];
      
      for (const cmd of dangerousCommands) {
        const result = await commandProcessor.process(cmd);
        expect(result.sanitized).toBe(true);
        expect(result.executed).toBe(false);
      }
    });
  });
});
```

## Continuous Improvement

### Metrics to Track
- Test execution time
- Flaky test frequency
- Coverage trends
- Defect escape rate
- Mutation score
- Property test failures

### Test Quality Gates

```yaml
# test-quality-gates.yml
quality_gates:
  coverage:
    unit: 85
    integration: 75
    e2e: 60
    mutation: 80
  
  performance:
    unit_test_time: 30s
    integration_test_time: 2m
    e2e_test_time: 5m
  
  reliability:
    max_flaky_rate: 0.01
    max_retry_count: 2
  
  security:
    dependency_check: true
    sast_scan: true
    secret_scanning: true
```

### Regular Reviews
- Weekly test review meetings
- Monthly coverage analysis
- Quarterly test strategy review
- Continuous property test refinement

### Documentation Updates
- Keep test documentation current
- Document testing decisions
- Share testing patterns and learnings
- Maintain golden sample library