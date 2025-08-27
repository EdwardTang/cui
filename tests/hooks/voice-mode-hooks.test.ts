/**
 * Tests for Voice Mode Hooks
 * Following enhanced TDD practices with research phase
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  VoiceHookManager, 
  HookType, 
  HookContext,
  LiveKitHooks,
  TDDHooks,
  voiceHooks 
} from '../../scripts/voice-mode-hooks';

// Test utilities
import { createMockRoom, createMockAudioTrack } from '../helpers/mockFactories';
import { waitForHook, simulateHookSequence } from '../helpers/hookHelpers';

describe('VoiceHookManager', () => {
  let hookManager: VoiceHookManager;
  
  beforeEach(() => {
    hookManager = new VoiceHookManager();
  });
  
  afterEach(() => {
    hookManager.clear();
  });
  
  describe('Hook Registration', () => {
    it('should register a hook handler', () => {
      const handler = vi.fn();
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, handler);
      
      expect(hookManager['hooks'].has(HookType.BEFORE_SESSION_CREATE)).toBe(true);
      expect(hookManager['hooks'].get(HookType.BEFORE_SESSION_CREATE)).toHaveLength(1);
    });
    
    it('should register multiple handlers for same hook type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, handler1);
      hookManager.register(HookType.BEFORE_SESSION_CREATE, handler2);
      
      expect(hookManager['hooks'].get(HookType.BEFORE_SESSION_CREATE)).toHaveLength(2);
    });
    
    it('should emit hookRegistered event', (done) => {
      hookManager.on('hookRegistered', (data) => {
        expect(data.type).toBe(HookType.BEFORE_SESSION_CREATE);
        expect(data.config.enabled).toBe(true);
        done();
      });
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, vi.fn());
    });
  });
  
  describe('Hook Execution', () => {
    it('should execute registered hooks', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, handler);
      
      const context = await hookManager.execute(HookType.BEFORE_SESSION_CREATE, {
        userId: 'user-123'
      });
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: HookType.BEFORE_SESSION_CREATE,
          userId: 'user-123'
        })
      );
      expect(context.performance?.duration).toBeDefined();
    });
    
    it('should execute hooks in order', async () => {
      const order: number[] = [];
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, async () => {
        order.push(1);
      });
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, async () => {
        order.push(2);
      });
      
      await hookManager.execute(HookType.BEFORE_SESSION_CREATE);
      
      expect(order).toEqual([1, 2]);
    });
    
    it('should handle hook timeout', async () => {
      const slowHandler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
      });
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, slowHandler, {
        enabled: true,
        async: false,
        timeout: 100
      });
      
      await expect(
        hookManager.execute(HookType.BEFORE_SESSION_CREATE)
      ).rejects.toThrow('Hook timeout');
    });
    
    it('should handle async hooks', async () => {
      const asyncHandler = vi.fn().mockResolvedValue(undefined);
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, asyncHandler, {
        enabled: true,
        async: true
      });
      
      await hookManager.execute(HookType.BEFORE_SESSION_CREATE);
      
      // Async handler should be called but not awaited
      expect(asyncHandler).toHaveBeenCalled();
    });
    
    it('should validate context with validators', async () => {
      const handler = vi.fn();
      const validator = vi.fn((ctx: HookContext) => ctx.userId !== undefined);
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, handler, {
        enabled: true,
        async: false,
        validators: [validator]
      });
      
      // Without userId - should skip handler
      await hookManager.execute(HookType.BEFORE_SESSION_CREATE);
      expect(handler).not.toHaveBeenCalled();
      
      // With userId - should execute handler
      await hookManager.execute(HookType.BEFORE_SESSION_CREATE, {
        userId: 'user-123'
      });
      expect(handler).toHaveBeenCalled();
    });
    
    it('should handle errors with custom error handler', async () => {
      const errorHandler = vi.fn();
      const failingHandler = vi.fn().mockRejectedValue(new Error('Test error'));
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, failingHandler, {
        enabled: true,
        async: false,
        errorHandler
      });
      
      await hookManager.execute(HookType.BEFORE_SESSION_CREATE);
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' })
      );
    });
  });
  
  describe('Metrics Collection', () => {
    it('should record hook execution metrics', async () => {
      const handler = vi.fn();
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, handler);
      
      await hookManager.execute(HookType.BEFORE_SESSION_CREATE);
      await hookManager.execute(HookType.BEFORE_SESSION_CREATE);
      
      const metrics = hookManager.getMetrics(HookType.BEFORE_SESSION_CREATE);
      
      expect(metrics.count).toBe(2);
      expect(metrics.totalDuration).toBeGreaterThan(0);
      expect(metrics.lastExecution).toBeDefined();
    });
    
    it('should emit metricsUpdated event', (done) => {
      hookManager.on('metricsUpdated', (data) => {
        expect(data.type).toBe(HookType.BEFORE_SESSION_CREATE);
        expect(data.metrics.count).toBe(1);
        done();
      });
      
      hookManager.register(HookType.BEFORE_SESSION_CREATE, vi.fn());
      hookManager.execute(HookType.BEFORE_SESSION_CREATE);
    });
  });
});

describe('LiveKit Hooks', () => {
  let hookManager: VoiceHookManager;
  let livekitHooks: LiveKitHooks;
  
  beforeEach(() => {
    hookManager = new VoiceHookManager();
    livekitHooks = new LiveKitHooks(hookManager);
  });
  
  describe('Room Lifecycle Hooks', () => {
    it('should validate room configuration before join', async () => {
      await expect(
        hookManager.execute(HookType.BEFORE_ROOM_JOIN, {
          data: { roomName: '', token: '' }
        })
      ).rejects.toThrow('Invalid room configuration');
    });
    
    it('should check network quality before join', async () => {
      const checkNetworkQuality = vi.spyOn(
        livekitHooks as any,
        'checkNetworkQuality'
      ).mockResolvedValue(5);
      
      await hookManager.execute(HookType.BEFORE_ROOM_JOIN, {
        data: { roomName: 'test-room', token: 'test-token' }
      });
      
      expect(checkNetworkQuality).toHaveBeenCalled();
    });
    
    it('should set up room event handlers after join', async () => {
      const mockRoom = createMockRoom();
      
      await hookManager.execute(HookType.AFTER_ROOM_JOIN, {
        data: { room: mockRoom }
      });
      
      expect(mockRoom.on).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function)
      );
    });
  });
  
  describe('Track Publishing Hooks', () => {
    it('should validate audio track before publishing', async () => {
      await expect(
        hookManager.execute(HookType.BEFORE_TRACK_PUBLISH, {
          data: { track: null }
        })
      ).rejects.toThrow('Invalid audio track');
    });
    
    it('should assess track quality before publishing', async () => {
      const mockTrack = createMockAudioTrack();
      const assessQuality = vi.spyOn(
        livekitHooks as any,
        'assessTrackQuality'
      ).mockResolvedValue({ score: 0.9 });
      
      await hookManager.execute(HookType.BEFORE_TRACK_PUBLISH, {
        data: { track: mockTrack }
      });
      
      expect(assessQuality).toHaveBeenCalledWith(mockTrack);
    });
  });
});

describe('TDD Hooks', () => {
  let hookManager: VoiceHookManager;
  let tddHooks: TDDHooks;
  
  beforeEach(() => {
    hookManager = new VoiceHookManager();
    tddHooks = new TDDHooks(hookManager);
  });
  
  describe('Research Phase', () => {
    it('should conduct research before test run', async () => {
      const conductResearch = vi.spyOn(
        tddHooks as any,
        'conductResearch'
      ).mockResolvedValue({
        bestPractices: ['practice1'],
        performanceConsiderations: ['perf1'],
        securityConcerns: ['security1'],
        testStrategies: ['strategy1']
      });
      
      const context = await hookManager.execute(HookType.BEFORE_TEST_RUN, {
        data: { taskId: 'task-123' }
      });
      
      expect(conductResearch).toHaveBeenCalledWith('task-123');
      expect(context.data.testStrategy).toBeDefined();
    });
    
    it('should generate test strategy from research', async () => {
      const generateStrategy = vi.spyOn(
        tddHooks as any,
        'generateTestStrategy'
      ).mockResolvedValue({
        unitTests: ['test1'],
        integrationTests: ['test2'],
        e2eTests: ['test3'],
        propertyTests: ['test4']
      });
      
      await hookManager.execute(HookType.BEFORE_TEST_RUN, {
        data: { taskId: 'task-123' }
      });
      
      expect(generateStrategy).toHaveBeenCalled();
    });
    
    it('should create golden samples', async () => {
      const createGoldenSamples = vi.spyOn(
        tddHooks as any,
        'createGoldenSamples'
      ).mockResolvedValue([
        { id: 'sample1', input: 'input1', expectedOutput: 'output1' }
      ]);
      
      const context = await hookManager.execute(HookType.BEFORE_TEST_RUN, {
        data: { taskId: 'task-123' }
      });
      
      expect(createGoldenSamples).toHaveBeenCalled();
      expect(context.data.goldenSamples).toHaveLength(1);
    });
  });
  
  describe('Test Execution', () => {
    it('should check coverage after test run', async () => {
      const results = {
        coverage: {
          unit: 90,
          integration: 80,
          e2e: 65
        }
      };
      
      await expect(
        hookManager.execute(HookType.AFTER_TEST_RUN, {
          data: { results }
        })
      ).resolves.not.toThrow();
    });
    
    it('should fail if coverage below threshold', async () => {
      const results = {
        coverage: {
          unit: 70, // Below 85% threshold
          integration: 80,
          e2e: 65
        }
      };
      
      await expect(
        hookManager.execute(HookType.AFTER_TEST_RUN, {
          data: { results }
        })
      ).rejects.toThrow('Unit test coverage 70% is below threshold (85%)');
    });
    
    it('should analyze flaky tests', async () => {
      const analyzeFlakyTests = vi.spyOn(
        tddHooks as any,
        'analyzeFlakyTests'
      ).mockResolvedValue(['test1', 'test2']);
      
      const results = {
        coverage: { unit: 90, integration: 80, e2e: 65 },
        tests: []
      };
      
      await hookManager.execute(HookType.AFTER_TEST_RUN, {
        data: { results }
      });
      
      expect(analyzeFlakyTests).toHaveBeenCalledWith(results);
    });
    
    it('should generate test report', async () => {
      const generateReport = vi.spyOn(
        tddHooks as any,
        'generateTestReport'
      ).mockResolvedValue({
        summary: { passed: 100, failed: 0 },
        details: [],
        recommendations: ['Add more integration tests']
      });
      
      const results = {
        coverage: { unit: 90, integration: 80, e2e: 65 }
      };
      
      const context = await hookManager.execute(HookType.AFTER_TEST_RUN, {
        data: { results }
      });
      
      expect(generateReport).toHaveBeenCalledWith(results);
      expect(context.data.report).toBeDefined();
    });
  });
});

describe('Voice Mode Default Hooks', () => {
  let hookManager: VoiceHookManager;
  
  beforeEach(() => {
    hookManager = new VoiceHookManager();
  });
  
  describe('Session Lifecycle', () => {
    it('should validate microphone permissions before session', async () => {
      // Mock getUserMedia
      const mockGetUserMedia = vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true
      });
      
      await hookManager.execute(HookType.BEFORE_SESSION_CREATE, {
        userId: 'user-123'
      });
      
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });
    
    it('should save transcript after session end', async () => {
      const saveTranscript = vi.spyOn(
        hookManager as any,
        'saveTranscript'
      ).mockResolvedValue(undefined);
      
      await hookManager.execute(HookType.AFTER_SESSION_END, {
        sessionId: 'session-123'
      });
      
      expect(saveTranscript).toHaveBeenCalledWith('session-123');
    });
  });
  
  describe('Audio Processing', () => {
    it('should reject oversized audio files', async () => {
      const largeAudio = new ArrayBuffer(11 * 1024 * 1024); // 11MB
      
      await expect(
        hookManager.execute(HookType.BEFORE_AUDIO_PROCESS, {
          data: largeAudio
        })
      ).rejects.toThrow('Audio file too large');
    });
    
    it('should preprocess audio before processing', async () => {
      const preprocessAudio = vi.spyOn(
        hookManager as any,
        'preprocessAudio'
      ).mockResolvedValue(new ArrayBuffer(1000));
      
      const audio = new ArrayBuffer(1000);
      
      const context = await hookManager.execute(HookType.BEFORE_AUDIO_PROCESS, {
        data: audio
      });
      
      expect(preprocessAudio).toHaveBeenCalledWith(audio);
      expect(context.data).toBeDefined();
    });
  });
  
  describe('Command Security', () => {
    it('should validate command security', async () => {
      const validateSecurity = vi.spyOn(
        hookManager as any,
        'validateCommandSecurity'
      );
      
      await hookManager.execute(HookType.BEFORE_COMMAND_EXECUTE, {
        userId: 'user-123',
        data: { command: { text: 'create component' } }
      });
      
      expect(validateSecurity).toHaveBeenCalled();
    });
    
    it('should reject dangerous commands', async () => {
      await expect(
        hookManager.execute(HookType.BEFORE_COMMAND_EXECUTE, {
          userId: 'user-123',
          data: { command: { text: 'rm -rf /' } }
        })
      ).rejects.toThrow('Security violation detected in command');
    });
  });
  
  describe('Quality Gates', () => {
    it('should check performance metrics', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      
      await hookManager.execute(HookType.QUALITY_GATE_CHECK, {
        data: {
          metrics: {
            latency: 250, // Above 200ms target
            sttAccuracy: 0.98,
            memoryUsage: 400 * 1024 * 1024
          }
        }
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Latency 250ms exceeds target')
      );
    });
    
    it('should check accuracy metrics', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      
      await hookManager.execute(HookType.QUALITY_GATE_CHECK, {
        data: {
          metrics: {
            latency: 150,
            sttAccuracy: 0.90, // Below 0.95 target
            memoryUsage: 400 * 1024 * 1024
          }
        }
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('STT accuracy 0.9 below target')
      );
    });
  });
});

describe('Hook Integration Scenarios', () => {
  let hookManager: VoiceHookManager;
  
  beforeEach(() => {
    hookManager = new VoiceHookManager();
    new LiveKitHooks(hookManager);
    new TDDHooks(hookManager);
  });
  
  it('should execute complete voice session flow', async () => {
    const hookSequence = [
      HookType.BEFORE_SESSION_CREATE,
      HookType.AFTER_SESSION_CREATE,
      HookType.BEFORE_ROOM_JOIN,
      HookType.AFTER_ROOM_JOIN,
      HookType.BEFORE_AUDIO_CAPTURE,
      HookType.AFTER_AUDIO_CAPTURE,
      HookType.BEFORE_TRANSCRIPTION,
      HookType.AFTER_TRANSCRIPTION,
      HookType.BEFORE_SESSION_END,
      HookType.AFTER_SESSION_END
    ];
    
    const executedHooks: HookType[] = [];
    
    for (const hookType of hookSequence) {
      hookManager.register(hookType, async () => {
        executedHooks.push(hookType);
      });
    }
    
    // Simulate session flow
    await simulateHookSequence(hookManager, hookSequence);
    
    expect(executedHooks).toEqual(hookSequence);
  });
  
  it('should handle parallel hook execution', async () => {
    const startTimes: number[] = [];
    
    // Register slow hooks
    for (let i = 0; i < 3; i++) {
      hookManager.register(HookType.BEFORE_SESSION_CREATE, async () => {
        startTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 100));
      }, { async: true });
    }
    
    await hookManager.execute(HookType.BEFORE_SESSION_CREATE);
    
    // Check that hooks started roughly at the same time (async)
    const timeDiffs = startTimes.slice(1).map((t, i) => t - startTimes[i]);
    expect(Math.max(...timeDiffs)).toBeLessThan(50); // Should be parallel
  });
  
  it('should maintain hook execution order within type', async () => {
    const executionOrder: string[] = [];
    
    hookManager.register(HookType.BEFORE_SESSION_CREATE, async () => {
      executionOrder.push('first');
    });
    
    hookManager.register(HookType.BEFORE_SESSION_CREATE, async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      executionOrder.push('second');
    });
    
    hookManager.register(HookType.BEFORE_SESSION_CREATE, async () => {
      executionOrder.push('third');
    });
    
    await hookManager.execute(HookType.BEFORE_SESSION_CREATE);
    
    expect(executionOrder).toEqual(['first', 'second', 'third']);
  });
});