# Voice Mode Hooks Implementation

## Overview

Comprehensive hooks system for Voice Mode development with LiveKit, implementing enhanced TDD practices and automated quality gates.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Voice Mode Hooks System                      │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Hook Manager                          │  │
│  │  - Registration & Execution                              │  │
│  │  - Metrics Collection                                    │  │
│  │  - Error Handling                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────┬───────────┴───────────┬────────────────┐   │
│  │               │                       │                │   │
│  │  Lifecycle    │     Processing       │   Quality      │   │
│  │    Hooks      │       Hooks          │    Gates       │   │
│  │               │                       │                │   │
│  │ - Session     │ - Audio Processing   │ - Coverage     │   │
│  │ - Room        │ - STT/TTS            │ - Performance  │   │
│  │ - Connection  │ - Command Execution  │ - Security     │   │
│  └───────────────┴───────────────────────┴────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Specialized Hooks                        │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │  │
│  │  │  LiveKit    │  │    TDD      │  │   Voice     │     │  │
│  │  │   Hooks     │  │   Hooks     │  │   Hooks     │     │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Hook Types

### Lifecycle Hooks
- `BEFORE_SESSION_CREATE`: Validate prerequisites, load preferences
- `AFTER_SESSION_CREATE`: Initialize monitoring, start recording
- `BEFORE_SESSION_END`: Prepare cleanup, final saves
- `AFTER_SESSION_END`: Cleanup resources, generate reports

### Audio Processing Hooks
- `BEFORE_AUDIO_CAPTURE`: Validate permissions, configure settings
- `AFTER_AUDIO_CAPTURE`: Process raw audio, apply filters
- `BEFORE_AUDIO_PROCESS`: Validate size/format, preprocess
- `AFTER_AUDIO_PROCESS`: Quality checks, caching

### STT/TTS Hooks
- `BEFORE_TRANSCRIPTION`: Audio validation, language detection
- `AFTER_TRANSCRIPTION`: Cache results, extract entities
- `BEFORE_SYNTHESIS`: Text validation, voice selection
- `AFTER_SYNTHESIS`: Audio post-processing, caching

### LiveKit Hooks
- `BEFORE_ROOM_JOIN`: Validate config, check network
- `AFTER_ROOM_JOIN`: Setup handlers, initialize tracks
- `BEFORE_TRACK_PUBLISH`: Validate track, assess quality
- `AFTER_TRACK_PUBLISH`: Monitor performance, handle errors

### Command Hooks
- `BEFORE_COMMAND_EXECUTE`: Security validation, permission check
- `AFTER_COMMAND_EXECUTE`: Log execution, update metrics

### Test Hooks
- `BEFORE_TEST_RUN`: Research phase, strategy generation
- `AFTER_TEST_RUN`: Coverage check, report generation
- `TEST_COVERAGE_CHECK`: Validate thresholds (85/75/60)

### Quality Gates
- `QUALITY_GATE_CHECK`: Performance, accuracy, resources
- `PERFORMANCE_CHECK`: Latency, throughput, memory
- `SECURITY_CHECK`: Input validation, command sanitization

## Implementation Files

### Core Implementation
- **`scripts/voice-mode-hooks.ts`**: TypeScript hook implementation
  - VoiceHookManager class
  - LiveKitHooks integration
  - TDDHooks for test automation
  - Default hook implementations

### Installation & Setup
- **`scripts/install-voice-hooks.sh`**: Automated installation script
  - Git hooks setup
  - Husky configuration
  - lint-staged rules
  - commitlint config

### Test Suite
- **`tests/hooks/voice-mode-hooks.test.ts`**: Comprehensive tests
  - Hook registration tests
  - Execution flow tests
  - Error handling tests
  - Integration scenarios

### Configuration Files
- **`.lintstagedrc.json`**: Pre-commit file processing
- **`commitlint.config.js`**: Commit message validation
- **`.husky/*`**: Husky hook scripts

## Enhanced TDD Features

### Research Phase Integration
```typescript
// Automatically triggered when task starts
async function onTaskStart(taskId: string): Promise<void> {
  const research = await conductResearch({
    parallel: true,
    sources: ['context7', 'deepWiki', 'exaResearch']
  });
  
  await recordFindings(taskId, research);
  await generateTestStrategy(research);
  await createGoldenSamples(research);
}
```

### Coverage Thresholds
- **Unit Tests**: ≥85%
- **Integration Tests**: ≥75%
- **E2E Tests**: ≥60%
- **Mutation Score**: ≥80%

### Golden Sample Management
```typescript
interface GoldenSample {
  id: string;
  category: 'audio' | 'transcript' | 'command' | 'response';
  input: any;
  expectedOutput: any;
  metadata: {
    validatedBy: string[];
    performance: {
      latency: number;
      accuracy: number;
    };
  };
}
```

## Git Hooks

### Pre-commit
- TypeScript type checking
- ESLint with auto-fix
- Prettier formatting
- Unit tests for changed files
- Voice Mode pattern checks
- Audio stream cleanup validation

### Pre-push
- Full test suite execution
- Coverage validation
- Integration tests
- Security audit
- Bundle size check (<10MB)
- LiveKit configuration check

### Commit-msg
- Conventional commit format
- Voice Mode specific scopes
- Auto-add PR/ticket numbers

## Usage

### Installation
```bash
# Install all hooks
./scripts/install-voice-hooks.sh

# Test hooks
npm run hooks:test

# Validate Voice Mode setup
npm run hooks:validate
```

### Manual Hook Execution
```typescript
import { voiceHooks, HookType } from './scripts/voice-mode-hooks';

// Register custom hook
voiceHooks.register(HookType.BEFORE_SESSION_CREATE, async (context) => {
  console.log('Custom pre-session logic');
  // Your custom logic here
});

// Execute hook manually
await voiceHooks.execute(HookType.BEFORE_SESSION_CREATE, {
  userId: 'user-123',
  sessionId: 'session-456'
});

// Get metrics
const metrics = voiceHooks.getMetrics(HookType.BEFORE_SESSION_CREATE);
console.log(`Hook executed ${metrics.count} times`);
```

### Testing Hooks
```typescript
// In your tests
import { VoiceHookManager } from './scripts/voice-mode-hooks';

describe('My Voice Feature', () => {
  let hookManager: VoiceHookManager;
  
  beforeEach(() => {
    hookManager = new VoiceHookManager();
    
    // Register test-specific hooks
    hookManager.register(HookType.AFTER_TRANSCRIPTION, async (ctx) => {
      // Validate transcription in tests
      expect(ctx.data.transcript).toBeDefined();
    });
  });
});
```

## Quality Gates

### Performance Targets
- **E2E Latency**: <200ms (P99)
- **STT Latency**: <100ms
- **TTS Latency**: <150ms
- **Memory Usage**: <512MB

### Reliability Targets
- **Flaky Test Rate**: <1%
- **Max Retries**: 2
- **Timeout**: 5s per hook

### Security Checks
- Input sanitization
- Command validation
- Permission verification
- Rate limiting

## Monitoring

### Metrics Collection
```typescript
interface HookMetrics {
  count: number;
  totalDuration: number;
  errors: number;
  lastExecution: number;
  avgDuration: number;
  p99Duration: number;
}
```

### Events
- `hookRegistered`: New hook registered
- `metricsUpdated`: Metrics updated after execution
- `hookError`: Error during hook execution
- `qualityGateFailed`: Quality gate check failed

## Best Practices

### Hook Design
1. **Keep hooks focused**: Single responsibility per hook
2. **Make hooks idempotent**: Safe to run multiple times
3. **Handle errors gracefully**: Use error handlers
4. **Set appropriate timeouts**: Prevent blocking
5. **Use async for non-critical**: Don't block main flow

### Testing
1. **Test hooks in isolation**: Unit test each hook
2. **Test hook sequences**: Integration test flows
3. **Mock external dependencies**: Keep tests fast
4. **Verify metrics collection**: Ensure observability
5. **Test error scenarios**: Validate error handling

### Performance
1. **Use async hooks**: For non-blocking operations
2. **Cache expensive operations**: Reduce redundant work
3. **Batch operations**: When possible
4. **Monitor hook duration**: Track performance
5. **Set reasonable timeouts**: Prevent hanging

## Troubleshooting

### Common Issues

#### Hook Not Executing
```bash
# Check if hook is registered
npm run hooks:test

# Verify hook is enabled
voiceHooks.getMetrics()
```

#### Hook Timeout
```typescript
// Increase timeout for slow operations
hookManager.register(HookType.BEFORE_SESSION_CREATE, handler, {
  timeout: 10000 // 10 seconds
});
```

#### Coverage Failing
```bash
# Check current coverage
npm run test:coverage

# Run specific test suite
npm run test:voice
npm run test:livekit
```

### Debug Mode
```typescript
// Enable debug logging
process.env.HOOK_DEBUG = 'true';

// In code
if (process.env.HOOK_DEBUG) {
  console.log('Hook context:', context);
}
```

## Future Enhancements

1. **Hook Plugins**: Loadable hook modules
2. **Hook Replay**: Record and replay hook sequences
3. **Distributed Hooks**: Cross-service hook coordination
4. **Hook Analytics**: Advanced metrics and visualization
5. **AI-Powered Hooks**: Intelligent hook suggestions

## References

- [Enhanced TDD Guide](./TDD_GUIDE.md)
- [Voice Mode LiveKit Design](./VOICE_MODE_LIVEKIT_DESIGN.md)
- [Task Breakdown](./VOICE_MODE_TASK_BREAKDOWN.md)
- [AI Agent Configuration](./AI_AGENT.md)