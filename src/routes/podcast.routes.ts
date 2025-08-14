import { Router, Request, Response } from 'express';
import { StreamManager } from '@/services/stream-manager.js';
import { PodcastfyService } from '@/services/podcastfy-service.js';
import { createLogger } from '@/services/logger.js';
import { RequestWithRequestId } from '@/types/express.js';
import { StreamEvent, PodcastProgressMessage, PodcastCompletedMessage } from '@/types/index.js';
import { 
  PodcastGenerationRequest, 
  PodcastTheme, 
  PodcastMetadataSerializer, 
  PODCAST_THEMES 
} from '@/types/podcast.js';
import { TaskSummaryGenerator } from '@/utils/taskSummary.js';
import { v4 as uuidv4 } from 'uuid';

export function createPodcastRoutes(streamManager: StreamManager): Router {
  const router = Router();
  const logger = createLogger('PodcastRoutes');
  const podcastfyService = PodcastfyService.getInstance(streamManager);
  // POST /api/podcast - Generate podcast with SSE progress streaming
  router.post('/', async (req: RequestWithRequestId, res: Response) => {
    const requestId = req.requestId;
    const streamingId = uuidv4();
    
    logger.debug('Podcast generation request received', {
      requestId,
      streamingId,
      body: req.body,
    });

    // Extract request parameters
    const {
      content,
      title = 'Generated Podcast',
      language = process.env.PODCAST_DEFAULT_LANG || 'en-US',
      voiceA,
      voiceB,
      theme: themeName = 'default',
      options = {},
    } = req.body as PodcastGenerationRequest;

    // Validate required parameters
    if (!content) {
      return res.status(400).json({
        error: 'Missing required parameter: content',
        streamingId,
      });
    }

    try {
      // Start SSE stream for progress updates
      const progressStream = res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial connection event
      const connectionEvent: StreamEvent = {
        type: 'connected',
        streaming_id: streamingId,
        timestamp: new Date().toISOString(),
      };
      
      streamManager.broadcast(streamingId, connectionEvent);
      
      // Add client to stream manager for progress updates
      streamManager.addClient(streamingId, res);

      // Send progress update
      const progressEvent: PodcastProgressMessage = {
        type: 'system',
        subtype: 'progress',
        streaming_id: streamingId,
        timestamp: new Date().toISOString(),
        progress: 10,
        message: 'Starting podcast generation...',
      };

      streamManager.broadcast(streamingId, progressEvent);

      // Generate structured podcast script and metadata
      const selectedTheme = PodcastMetadataSerializer.getTheme(typeof themeName === 'string' ? themeName : 'default');
      
      // Progress: Script generation
      const scriptProgressEvent: PodcastProgressMessage = {
        type: 'system',
        subtype: 'progress',
        streaming_id: streamingId,
        timestamp: new Date().toISOString(),
        progress: 30,
        message: 'Generating podcast script...',
      };
      streamManager.broadcast(streamingId, scriptProgressEvent);

      // Generate the podcast script with structured metadata
      const generatedScript = TaskSummaryGenerator.generatePodcastScript(
        content,
        title,
        selectedTheme,
        {
          conversationStyle: options.conversationStyle || 'casual',
          targetDuration: options.maxDuration || 300,
          maxChapters: 5,
        }
      );

      // Create comprehensive metadata
      const podcastMetadata = TaskSummaryGenerator.createMetadataFromScript(
        generatedScript,
        title,
        language,
        selectedTheme,
        streamingId
      );

      // Progress: Metadata processing
      const metadataProgressEvent: PodcastProgressMessage = {
        type: 'system',
        subtype: 'progress',
        streaming_id: streamingId,
        timestamp: new Date().toISOString(),
        progress: 60,
        message: 'Processing metadata and chapters...',
      };
      streamManager.broadcast(streamingId, metadataProgressEvent);

      // Start actual podcast generation using PodcastfyService
      const generationProgressEvent: PodcastProgressMessage = {
        type: 'system',
        subtype: 'progress',
        streaming_id: streamingId,
        timestamp: new Date().toISOString(),
        progress: 70,
        message: 'Starting audio generation...',
      };
      streamManager.broadcast(streamingId, generationProgressEvent);

      // Prepare conversation data and generation parameters
      const conversationData = {
        content,
        title,
        script: generatedScript,
        metadata: podcastMetadata,
      };

      const generationParams = {
        theme: selectedTheme.name,
        language,
        voiceA: voiceA || 'alloy',
        voiceB: voiceB || 'echo',
        service_url: process.env.PODCASTFY_URL,
        conversationStyle: options.conversationStyle || 'casual',
        targetDuration: options.maxDuration || 300,
        ...options,
      };

      // Start podcast generation with child process
      await podcastfyService.generatePodcast(streamingId, {
        conversationData,
        generationParams,
      });

    } catch (error) {
      logger.error('Error in podcast generation', error, {
        requestId,
        streamingId,
      });

      const errorEvent: StreamEvent = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        streamingId,
        timestamp: new Date().toISOString(),
      };

      streamManager.broadcast(streamingId, errorEvent);
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          streamingId,
        });
      }
    }
  });

  // GET /api/podcast/:streamingId/progress - Connect to existing podcast generation progress
  router.get('/:streamingId/progress', (req: RequestWithRequestId, res: Response) => {
    const { streamingId } = req.params;
    const requestId = req.requestId;

    logger.debug('Podcast progress stream connection request', {
      requestId,
      streamingId,
    });

    // Add client to existing stream
    streamManager.addClient(streamingId, res);

    res.on('close', () => {
      logger.debug('Podcast progress stream connection closed', {
        requestId,
        streamingId,
      });
    });
  });

  // DELETE /api/podcast/:streamingId - Cancel active podcast generation
  router.delete('/:streamingId', (req: RequestWithRequestId, res: Response) => {
    const { streamingId } = req.params;
    const requestId = req.requestId;

    logger.debug('Podcast cancellation request', { requestId, streamingId });

    try {
      const cancelled = podcastfyService.cancelGeneration(streamingId);
      
      if (cancelled) {
        res.json({
          success: true,
          message: 'Podcast generation cancelled',
          streamingId,
        });
      } else {
        res.status(404).json({
          error: 'No active generation found for this streaming ID',
          streamingId,
        });
      }
    } catch (error) {
      logger.error('Error cancelling podcast generation', error, { requestId, streamingId });
      res.status(500).json({
        error: 'Failed to cancel podcast generation',
        streamingId,
      });
    }
  });

  // GET /api/podcast/:streamingId/status - Get generation status
  router.get('/:streamingId/status', (req: RequestWithRequestId, res: Response) => {
    const { streamingId } = req.params;
    const requestId = req.requestId;

    logger.debug('Generation status request', { requestId, streamingId });

    try {
      const status = podcastfyService.getGenerationStatus(streamingId);
      
      res.json({
        success: true,
        streamingId,
        ...status,
      });
    } catch (error) {
      logger.error('Error getting generation status', error, { requestId, streamingId });
      res.status(500).json({
        error: 'Failed to get generation status',
        streamingId,
      });
    }
  });

  // GET /api/podcast/themes - Get available themes
  router.get('/themes', (req: RequestWithRequestId, res: Response) => {
    const requestId = req.requestId;
    
    logger.debug('Themes request received', { requestId });

    try {
      const themes = Object.values(PODCAST_THEMES).map(theme => ({
        name: theme.name,
        displayName: theme.displayName,
        colors: theme.colors,
        typography: theme.typography,
        voiceSettings: theme.voiceSettings,
      }));

      res.json({
        success: true,
        themes,
        default: 'default',
      });
    } catch (error) {
      logger.error('Error fetching themes', error, { requestId });
      res.status(500).json({
        error: 'Failed to fetch themes',
      });
    }
  });

  // GET /api/podcast/metadata/:streamingId - Get podcast metadata
  router.get('/metadata/:streamingId', (req: RequestWithRequestId, res: Response) => {
    const { streamingId } = req.params;
    const requestId = req.requestId;
    
    logger.debug('Metadata request received', { requestId, streamingId });

    try {
      // In production, this would fetch from database or storage
      // For now, return a sample response structure
      res.json({
        success: true,
        streamingId,
        metadata: {
          title: 'Sample Podcast',
          language: 'en-US',
          duration: 300,
          speakers: [
            { name: 'Alex', voice: 'Alloy', role: 'host' },
            { name: 'Sam', voice: 'Verse', role: 'host' },
          ],
          chapters: [
            { title: 'Introduction', startTime: 0, duration: 30 },
            { title: 'Main Discussion', startTime: 30, duration: 240 },
            { title: 'Conclusion', startTime: 270, duration: 30 },
          ],
          theme: PODCAST_THEMES.default,
        },
      });
    } catch (error) {
      logger.error('Error fetching metadata', error, { requestId, streamingId });
      res.status(500).json({
        error: 'Failed to fetch metadata',
      });
    }
  });

  return router;
}