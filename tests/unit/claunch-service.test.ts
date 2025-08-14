import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaunchService } from '../../src/services/claunch-service.js';

describe('ClaunchService', () => {
  let service: ClaunchService;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (service) {
      service.destroy();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      service = new ClaunchService();
      const status = service.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.config.intervalMs).toBe(30000);
      expect(status.config.inactivityTimeoutMs).toBe(300000);
      expect(status.config.autoReconnect).toBe(false);
      expect(status.config.maxReconnectAttempts).toBe(3);
    });

    it('should accept custom configuration', () => {
      service = new ClaunchService({
        enabled: false,
        intervalMs: 60000,
        inactivityTimeoutMs: 600000,
        autoReconnect: true,
        maxReconnectAttempts: 5,
      });

      const status = service.getStatus();
      expect(status.enabled).toBe(false);
      expect(status.config.intervalMs).toBe(60000);
      expect(status.config.inactivityTimeoutMs).toBe(600000);
      expect(status.config.autoReconnect).toBe(true);
      expect(status.config.maxReconnectAttempts).toBe(5);
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring a session', () => {
      service = new ClaunchService();
      const streamingId = 'test-session-123';

      service.startMonitoring(streamingId);

      const status = service.getStatus();
      expect(status.sessions).toHaveLength(1);
      expect(status.sessions[0].streamingId).toBe(streamingId);
      expect(status.sessions[0].isActive).toBe(true);
    });

    it('should not start monitoring when disabled', () => {
      service = new ClaunchService({ enabled: false });
      const streamingId = 'test-session-123';

      service.startMonitoring(streamingId);

      const status = service.getStatus();
      expect(status.sessions).toHaveLength(0);
    });

    it('should not duplicate monitoring for same session', () => {
      service = new ClaunchService();
      const streamingId = 'test-session-123';

      service.startMonitoring(streamingId);
      service.startMonitoring(streamingId);

      const status = service.getStatus();
      expect(status.sessions).toHaveLength(1);
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring a session', () => {
      service = new ClaunchService();
      const streamingId = 'test-session-123';

      service.startMonitoring(streamingId);
      expect(service.getStatus().sessions).toHaveLength(1);

      service.stopMonitoring(streamingId);
      expect(service.getStatus().sessions).toHaveLength(0);
    });

    it('should handle stopping non-existent session gracefully', () => {
      service = new ClaunchService();

      // Should not throw
      expect(() => service.stopMonitoring('non-existent')).not.toThrow();
    });
  });

  describe('updateActivity', () => {
    it('should update session activity timestamp', () => {
      service = new ClaunchService();
      const streamingId = 'test-session-123';

      service.startMonitoring(streamingId);
      const initialActivity = service.getStatus().sessions[0].lastActivity;

      // Advance time
      vi.advanceTimersByTime(5000);

      service.updateActivity(streamingId);
      const updatedActivity = service.getStatus().sessions[0].lastActivity;

      expect(updatedActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });

    it('should mark session as active when updating activity', () => {
      service = new ClaunchService();
      const streamingId = 'test-session-123';

      service.startMonitoring(streamingId);
      service.updateActivity(streamingId);

      const session = service.getStatus().sessions[0];
      expect(session.isActive).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service = new ClaunchService();

      service.updateConfig({
        intervalMs: 45000,
        autoReconnect: true,
      });

      const config = service.getStatus().config;
      expect(config.intervalMs).toBe(45000);
      expect(config.autoReconnect).toBe(true);
      // Other values should remain unchanged
      expect(config.inactivityTimeoutMs).toBe(300000);
    });
  });

  describe('getStatus', () => {
    it('should return complete status information', () => {
      service = new ClaunchService();
      const streamingId1 = 'session-1';
      const streamingId2 = 'session-2';

      service.startMonitoring(streamingId1);
      service.startMonitoring(streamingId2);

      const status = service.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('config');
      expect(status).toHaveProperty('sessions');
      expect(status.sessions).toHaveLength(2);

      // Each session should have required properties
      status.sessions.forEach((session) => {
        expect(session).toHaveProperty('streamingId');
        expect(session).toHaveProperty('lastActivity');
        expect(session).toHaveProperty('isActive');
        expect(session).toHaveProperty('reconnectAttempts');
        expect(session).toHaveProperty('inactiveMs');
      });
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      service = new ClaunchService();
      const streamingId1 = 'session-1';
      const streamingId2 = 'session-2';

      service.startMonitoring(streamingId1);
      service.startMonitoring(streamingId2);

      expect(service.getStatus().sessions).toHaveLength(2);

      service.destroy();

      expect(service.getStatus().sessions).toHaveLength(0);
    });
  });
});
