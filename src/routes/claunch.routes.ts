import { Router, Request, Response } from 'express';
import { ClaunchService, ClaunchConfig } from '../services/claunch-service.js';
import { createLogger } from '../services/logger.js';

const logger = createLogger('ClaunchRoutes');

export function createClaunchRoutes(claunchService: ClaunchService): Router {
  const router = Router();

  /**
   * GET /api/claunch/status
   * Get the status of claunch service and all monitored sessions
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const status = claunchService.getStatus();
      res.json(status);
    } catch (error) {
      logger.error('Error getting claunch status', error);
      res.status(500).json({ error: 'Failed to get claunch status' });
    }
  });

  /**
   * POST /api/claunch/config
   * Update claunch configuration
   */
  router.post('/config', (req: Request, res: Response) => {
    try {
      const config: Partial<ClaunchConfig> = req.body;

      // Validate config
      if (
        config.intervalMs !== undefined &&
        (config.intervalMs < 1000 || config.intervalMs > 300000)
      ) {
        return res.status(400).json({
          error: 'Invalid intervalMs. Must be between 1000 and 300000 (1 second to 5 minutes)',
        });
      }

      if (config.inactivityTimeoutMs !== undefined && config.inactivityTimeoutMs < 10000) {
        return res.status(400).json({
          error: 'Invalid inactivityTimeoutMs. Must be at least 10000 (10 seconds)',
        });
      }

      if (
        config.maxReconnectAttempts !== undefined &&
        (config.maxReconnectAttempts < 0 || config.maxReconnectAttempts > 10)
      ) {
        return res.status(400).json({
          error: 'Invalid maxReconnectAttempts. Must be between 0 and 10',
        });
      }

      claunchService.updateConfig(config);
      logger.info('Claunch configuration updated', { config });

      res.json({
        success: true,
        config: claunchService.getStatus().config,
      });
    } catch (error) {
      logger.error('Error updating claunch config', error);
      res.status(500).json({ error: 'Failed to update claunch config' });
    }
  });

  /**
   * POST /api/claunch/sessions/:streamingId/start
   * Start monitoring a specific session
   */
  router.post('/sessions/:streamingId/start', (req: Request, res: Response) => {
    try {
      const { streamingId } = req.params;

      if (!streamingId) {
        return res.status(400).json({ error: 'streamingId is required' });
      }

      claunchService.startMonitoring(streamingId);
      logger.info('Started claunch monitoring for session', { streamingId });

      res.json({
        success: true,
        message: `Started monitoring session ${streamingId}`,
      });
    } catch (error) {
      logger.error('Error updating claunch config', error);
      res.status(500).json({ error: 'Failed to update claunch config' });
    }
  });

  /**
   * POST /api/claunch/sessions/:streamingId/stop
   * Stop monitoring a specific session
   */
  router.post('/sessions/:streamingId/stop', (req: Request, res: Response) => {
    try {
      const { streamingId } = req.params;

      if (!streamingId) {
        return res.status(400).json({ error: 'streamingId is required' });
      }

      claunchService.stopMonitoring(streamingId);
      logger.info('Stopped claunch monitoring for session', { streamingId });

      res.json({
        success: true,
        message: `Stopped monitoring session ${streamingId}`,
      });
    } catch (error) {
      logger.error('Error updating claunch config', error);
      res.status(500).json({ error: 'Failed to update claunch config' });
    }
  });

  /**
   * POST /api/claunch/sessions/:streamingId/ping
   * Manually trigger activity update for a session
   */
  router.post('/sessions/:streamingId/ping', (req: Request, res: Response) => {
    try {
      const { streamingId } = req.params;

      if (!streamingId) {
        return res.status(400).json({ error: 'streamingId is required' });
      }

      claunchService.updateActivity(streamingId);
      logger.debug('Manual activity update for session', { streamingId });

      res.json({
        success: true,
        message: `Activity updated for session ${streamingId}`,
      });
    } catch (error) {
      logger.error('Error updating claunch config', error);
      res.status(500).json({ error: 'Failed to update claunch config' });
    }
  });

  /**
   * GET /api/claunch/config
   * Get current claunch configuration
   */
  router.get('/config', (req: Request, res: Response) => {
    try {
      const status = claunchService.getStatus();
      res.json(status.config);
    } catch (error) {
      logger.error('Error updating claunch config', error);
      res.status(500).json({ error: 'Failed to update claunch config' });
    }
  });

  return router;
}
