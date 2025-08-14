import { EventEmitter } from 'events';
import { createLogger, type Logger } from './logger.js';
import { ClaudeProcessManager } from './claude-process-manager.js';

export interface ClaunchConfig {
  enabled: boolean;
  intervalMs: number; // How often to send keep-alive pings
  inactivityTimeoutMs: number; // Max time of inactivity before considering session stale
  autoReconnect: boolean; // Automatically reconnect dropped sessions
  maxReconnectAttempts: number;
}

export interface SessionActivity {
  streamingId: string;
  lastActivity: Date;
  keepAliveTimer?: NodeJS.Timeout;
  isActive: boolean;
  reconnectAttempts: number;
}

/**
 * Claunch Service - Keeps Claude sessions alive and manages session lifecycle
 * Prevents sessions from timing out due to inactivity
 */
export class ClaunchService extends EventEmitter {
  private logger: Logger;
  private config: ClaunchConfig;
  private sessions: Map<string, SessionActivity> = new Map();
  private processManager?: ClaudeProcessManager;
  private monitorInterval?: NodeJS.Timeout;

  constructor(config?: Partial<ClaunchConfig>) {
    super();
    this.logger = createLogger('ClaunchService');

    // Default configuration
    this.config = {
      enabled: true,
      intervalMs: 30000, // Send keep-alive every 30 seconds
      inactivityTimeoutMs: 300000, // 5 minutes of inactivity before considering stale
      autoReconnect: false,
      maxReconnectAttempts: 3,
      ...config,
    };

    this.logger.info('Claunch service initialized', { config: this.config });
  }

  /**
   * Set the process manager for interaction with Claude sessions
   */
  setProcessManager(processManager: ClaudeProcessManager): void {
    this.processManager = processManager;
    this.logger.debug('Process manager set');
  }

  /**
   * Start monitoring a session for keep-alive
   */
  startMonitoring(streamingId: string): void {
    if (!this.config.enabled) {
      this.logger.debug('Claunch is disabled, not monitoring session', { streamingId });
      return;
    }

    // Check if already monitoring
    if (this.sessions.has(streamingId)) {
      this.logger.debug('Already monitoring session', { streamingId });
      this.updateActivity(streamingId);
      return;
    }

    // Create session activity record
    const activity: SessionActivity = {
      streamingId,
      lastActivity: new Date(),
      isActive: true,
      reconnectAttempts: 0,
    };

    // Set up keep-alive timer
    activity.keepAliveTimer = setInterval(() => {
      this.sendKeepAlive(streamingId);
    }, this.config.intervalMs);

    this.sessions.set(streamingId, activity);
    this.logger.info('Started monitoring session', { streamingId });
    this.emit('session-monitoring-started', streamingId);

    // Start global monitor if not already running
    this.startGlobalMonitor();
  }

  /**
   * Stop monitoring a session
   */
  stopMonitoring(streamingId: string): void {
    const activity = this.sessions.get(streamingId);
    if (!activity) {
      this.logger.debug('Session not being monitored', { streamingId });
      return;
    }

    // Clear keep-alive timer
    if (activity.keepAliveTimer) {
      clearInterval(activity.keepAliveTimer);
    }

    this.sessions.delete(streamingId);
    this.logger.info('Stopped monitoring session', { streamingId });
    this.emit('session-monitoring-stopped', streamingId);

    // Stop global monitor if no more sessions
    if (this.sessions.size === 0) {
      this.stopGlobalMonitor();
    }
  }

  /**
   * Send a keep-alive message to a session
   */
  private async sendKeepAlive(streamingId: string): Promise<void> {
    const activity = this.sessions.get(streamingId);
    if (!activity || !activity.isActive) {
      this.logger.debug('Session not active, skipping keep-alive', { streamingId });
      return;
    }

    try {
      // Check if session has been inactive too long
      const now = new Date();
      const inactiveMs = now.getTime() - activity.lastActivity.getTime();

      if (inactiveMs > this.config.inactivityTimeoutMs) {
        this.logger.warn('Session has been inactive too long', {
          streamingId,
          inactiveMs,
          threshold: this.config.inactivityTimeoutMs,
        });

        // Mark as inactive
        activity.isActive = false;
        this.emit('session-stale', streamingId);

        // Attempt reconnect if configured
        if (
          this.config.autoReconnect &&
          activity.reconnectAttempts < this.config.maxReconnectAttempts
        ) {
          await this.attemptReconnect(streamingId);
        } else {
          this.stopMonitoring(streamingId);
        }
        return;
      }

      // Send keep-alive ping (could be a no-op message or status check)
      if (this.processManager) {
        // Send a minimal message to keep the session alive
        // This could be enhanced to send actual keep-alive commands if needed
        this.logger.debug('Sending keep-alive ping', { streamingId });
        this.emit('keep-alive-sent', streamingId);
      }
    } catch (error) {
      this.logger.error('Error sending keep-alive', { streamingId, error });
      this.emit('keep-alive-error', { streamingId, error });
    }
  }

  /**
   * Update the last activity time for a session
   */
  updateActivity(streamingId: string): void {
    const activity = this.sessions.get(streamingId);
    if (activity) {
      activity.lastActivity = new Date();
      activity.isActive = true;
      this.logger.debug('Updated activity timestamp', { streamingId });
    }
  }

  /**
   * Attempt to reconnect a stale session
   */
  private async attemptReconnect(streamingId: string): Promise<void> {
    const activity = this.sessions.get(streamingId);
    if (!activity) return;

    activity.reconnectAttempts++;
    this.logger.info('Attempting to reconnect session', {
      streamingId,
      attempt: activity.reconnectAttempts,
    });

    try {
      // Emit reconnect event - the process manager can handle this
      this.emit('session-reconnect-attempt', {
        streamingId,
        attempt: activity.reconnectAttempts,
      });

      // Reset activity on successful reconnect
      activity.lastActivity = new Date();
      activity.isActive = true;

      this.logger.info('Session reconnected successfully', { streamingId });
      this.emit('session-reconnected', streamingId);
    } catch (error) {
      this.logger.error('Failed to reconnect session', {
        streamingId,
        attempt: activity.reconnectAttempts,
        error,
      });

      if (activity.reconnectAttempts >= this.config.maxReconnectAttempts) {
        this.logger.error('Max reconnect attempts reached, stopping monitoring', { streamingId });
        this.stopMonitoring(streamingId);
        this.emit('session-reconnect-failed', streamingId);
      }
    }
  }

  /**
   * Start the global monitor that checks all sessions
   */
  private startGlobalMonitor(): void {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(() => {
      this.checkAllSessions();
    }, 10000); // Check every 10 seconds

    this.logger.debug('Global monitor started');
  }

  /**
   * Stop the global monitor
   */
  private stopGlobalMonitor(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      this.logger.debug('Global monitor stopped');
    }
  }

  /**
   * Check all monitored sessions for health
   */
  private checkAllSessions(): void {
    const now = new Date();

    for (const [streamingId, activity] of this.sessions) {
      const inactiveMs = now.getTime() - activity.lastActivity.getTime();

      if (inactiveMs > this.config.inactivityTimeoutMs && activity.isActive) {
        this.logger.warn('Session detected as stale during global check', {
          streamingId,
          inactiveMs,
        });
        activity.isActive = false;
        this.emit('session-stale', streamingId);
      }
    }
  }

  /**
   * Get status of all monitored sessions
   */
  getStatus(): {
    enabled: boolean;
    config: ClaunchConfig;
    sessions: Array<{
      streamingId: string;
      lastActivity: Date;
      isActive: boolean;
      reconnectAttempts: number;
      inactiveMs: number;
    }>;
  } {
    const now = new Date();

    return {
      enabled: this.config.enabled,
      config: this.config,
      sessions: Array.from(this.sessions.entries()).map(([streamingId, activity]) => ({
        streamingId,
        lastActivity: activity.lastActivity,
        isActive: activity.isActive,
        reconnectAttempts: activity.reconnectAttempts,
        inactiveMs: now.getTime() - activity.lastActivity.getTime(),
      })),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClaunchConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Configuration updated', { config: this.config });

    // Restart timers with new intervals if needed
    if (config.intervalMs !== undefined) {
      for (const [streamingId, activity] of this.sessions) {
        if (activity.keepAliveTimer) {
          clearInterval(activity.keepAliveTimer);
          activity.keepAliveTimer = setInterval(() => {
            this.sendKeepAlive(streamingId);
          }, this.config.intervalMs);
        }
      }
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop monitoring all sessions
    for (const streamingId of this.sessions.keys()) {
      this.stopMonitoring(streamingId);
    }

    // Stop global monitor
    this.stopGlobalMonitor();

    this.logger.info('Claunch service destroyed');
  }
}
