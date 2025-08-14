import { spawn, ChildProcess } from 'child_process';
import { createLogger } from './logger.js';
import { StreamManager } from './stream-manager.js';
import { PodcastProgressMessage } from '@/types/index.js';
import { PodcastGenerationRequest, PodcastMetadata } from '@/types/podcast.js';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

interface PythonProgressMessage {
  type: 'progress' | 'complete' | 'error';
  timestamp?: number;
  step?: string;
  percent?: number;
  file_path?: string;
  metadata?: Record<string, any>;
  error?: string;
  code?: string;
}

interface PodcastGenerationOptions {
  conversationData: any;
  generationParams: {
    theme?: string;
    language?: string;
    voiceA?: string;
    voiceB?: string;
    service_url?: string;
    [key: string]: any;
  };
}

interface ActiveGeneration {
  streamingId: string;
  process: ChildProcess;
  configFilePath: string;
  startTime: number;
  timeoutHandle?: NodeJS.Timeout;
}

export class PodcastfyService {
  private static instance: PodcastfyService;
  private logger = createLogger('PodcastfyService');
  private activeGenerations = new Map<string, ActiveGeneration>();
  private readonly PYTHON_SCRIPT_PATH: string;
  private readonly TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  
  private constructor(private streamManager: StreamManager) {
    // Path to the Python wrapper script
    this.PYTHON_SCRIPT_PATH = join(process.cwd(), 'src', 'scripts', 'podcastfy_wrapper.py');
  }
  
  public static getInstance(streamManager: StreamManager): PodcastfyService {
    if (!PodcastfyService.instance) {
      PodcastfyService.instance = new PodcastfyService(streamManager);
    }
    return PodcastfyService.instance;
  }
  
  /**
   * Generate podcast using Python wrapper script
   */
  public async generatePodcast(
    streamingId: string,
    options: PodcastGenerationOptions
  ): Promise<void> {
    try {
      this.logger.info('Starting podcast generation', { streamingId });
      
      // Create temporary config file
      const configFilePath = await this.createConfigFile(options);
      
      // Spawn Python process
      const pythonProcess = await this.spawnPythonProcess(streamingId, configFilePath);
      
      // Store active generation
      const activeGeneration: ActiveGeneration = {
        streamingId,
        process: pythonProcess,
        configFilePath,
        startTime: Date.now(),
      };
      
      this.activeGenerations.set(streamingId, activeGeneration);
      
      // Set up timeout
      activeGeneration.timeoutHandle = setTimeout(() => {
        this.handleTimeout(streamingId);
      }, this.TIMEOUT_MS);
      
      // Handle process events
      this.setupProcessEventHandlers(streamingId, pythonProcess);
      
    } catch (error) {
      this.logger.error('Failed to start podcast generation', error, { streamingId });
      this.handleError(streamingId, `Failed to start podcast generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Cancel active podcast generation
   */
  public cancelGeneration(streamingId: string): boolean {
    const activeGeneration = this.activeGenerations.get(streamingId);
    
    if (!activeGeneration) {
      this.logger.warn('Attempted to cancel non-existent generation', { streamingId });
      return false;
    }
    
    this.logger.info('Cancelling podcast generation', { streamingId });
    
    // Kill the process
    if (!activeGeneration.process.killed) {
      activeGeneration.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!activeGeneration.process.killed) {
          activeGeneration.process.kill('SIGKILL');
        }
      }, 5000);
    }
    
    // Clean up
    this.cleanupGeneration(streamingId);
    
    // Notify client of cancellation
    this.streamManager.broadcast(streamingId, {
      type: 'error',
      error: 'Generation cancelled by user',
      streamingId,
      timestamp: new Date().toISOString(),
    });
    
    return true;
  }
  
  /**
   * Get status of active generation
   */
  public getGenerationStatus(streamingId: string): { active: boolean; startTime?: number; duration?: number } {
    const activeGeneration = this.activeGenerations.get(streamingId);
    
    if (!activeGeneration) {
      return { active: false };
    }
    
    return {
      active: true,
      startTime: activeGeneration.startTime,
      duration: Date.now() - activeGeneration.startTime,
    };
  }
  
  /**
   * Create temporary configuration file for Python script
   */
  private async createConfigFile(options: PodcastGenerationOptions): Promise<string> {
    const configId = uuidv4();
    const configFilePath = join(tmpdir(), `podcastfy_config_${configId}.json`);
    
    const config = {
      conversation: options.conversationData,
      params: {
        ...options.generationParams,
        service_url: process.env.PODCASTFY_URL || options.generationParams.service_url || 'http://localhost:8123',
      },
    };
    
    await writeFile(configFilePath, JSON.stringify(config, null, 2), 'utf8');
    
    this.logger.debug('Created config file', { configFilePath });
    
    return configFilePath;
  }
  
  /**
   * Spawn Python wrapper process
   */
  private async spawnPythonProcess(streamingId: string, configFilePath: string): Promise<ChildProcess> {
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';
    const serviceUrl = process.env.PODCASTFY_URL;
    
    const args = ['--config', configFilePath];
    if (serviceUrl) {
      args.push('--url', serviceUrl);
    }
    
    this.logger.debug('Spawning Python process', {
      streamingId,
      executable: pythonExecutable,
      script: this.PYTHON_SCRIPT_PATH,
      args,
    });
    
    const pythonProcess = spawn(pythonExecutable, [this.PYTHON_SCRIPT_PATH, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PODCASTFY_URL: process.env.PODCASTFY_URL || 'http://localhost:8123',
      },
    });
    
    return pythonProcess;
  }
  
  /**
   * Set up event handlers for Python process
   */
  private setupProcessEventHandlers(streamingId: string, pythonProcess: ChildProcess): void {
    // Handle stdout (JSON progress updates)
    pythonProcess.stdout?.on('data', (data: Buffer) => {
      this.handleStdoutData(streamingId, data);
    });
    
    // Handle stderr (error logs)
    pythonProcess.stderr?.on('data', (data: Buffer) => {
      this.handleStderrData(streamingId, data);
    });
    
    // Handle process exit
    pythonProcess.on('exit', (code: number | null, signal: string | null) => {
      this.handleProcessExit(streamingId, code, signal);
    });
    
    // Handle process error
    pythonProcess.on('error', (error: Error) => {
      this.handleProcessError(streamingId, error);
    });
  }
  
  /**
   * Handle stdout data from Python process (JSON progress updates)
   */
  private handleStdoutData(streamingId: string, data: Buffer): void {
    const output = data.toString('utf8').trim();
    
    // Split by lines in case multiple JSON messages are received at once
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const progressMessage: PythonProgressMessage = JSON.parse(line);
        this.handleProgressMessage(streamingId, progressMessage);
      } catch (error) {
        this.logger.warn('Failed to parse JSON progress message', { streamingId, line, error });
      }
    }
  }
  
  /**
   * Handle stderr data from Python process
   */
  private handleStderrData(streamingId: string, data: Buffer): void {
    const errorOutput = data.toString('utf8').trim();
    this.logger.warn('Python process stderr', { streamingId, errorOutput });
    
    // Send as progress message for debugging
    this.sendProgress(streamingId, {
      type: 'system',
      subtype: 'progress',
      streaming_id: streamingId,
      timestamp: new Date().toISOString(),
      progress: -1,
      message: `Debug: ${errorOutput}`,
    });
  }
  
  /**
   * Handle progress message from Python script
   */
  private handleProgressMessage(streamingId: string, message: PythonProgressMessage): void {
    this.logger.debug('Received progress message', { streamingId, message });
    
    switch (message.type) {
      case 'progress':
        this.sendProgress(streamingId, {
          type: 'system',
          subtype: 'progress',
          streaming_id: streamingId,
          timestamp: new Date().toISOString(),
          progress: message.percent || 50,
          message: `${message.step || 'Processing'}...`,
        });
        break;
        
      case 'complete':
        this.handleCompletion(streamingId, message);
        break;
        
      case 'error':
        this.handleError(streamingId, message.error || 'Unknown error from Python script', message.code);
        break;
        
      default:
        this.logger.warn('Unknown progress message type', { streamingId, message });
    }
  }
  
  /**
   * Handle successful completion
   */
  private handleCompletion(streamingId: string, message: PythonProgressMessage): void {
    this.logger.info('Podcast generation completed successfully', { streamingId, filePath: message.file_path });
    
    // Send completion event
    this.streamManager.broadcast(streamingId, {
      type: 'system',
      subtype: 'podcast_completed' as any,
      streaming_id: streamingId,
      timestamp: new Date().toISOString(),
      result: {
        audioUrl: message.file_path || `/api/podcasts/${streamingId}/audio.m4a`,
        metadata: message.metadata || {},
      },
    });
    
    // Send final progress
    this.sendProgress(streamingId, {
      type: 'system',
      subtype: 'progress',
      streaming_id: streamingId,
      timestamp: new Date().toISOString(),
      progress: 100,
      message: 'Podcast generation complete!',
    });
    
    // Clean up
    this.cleanupGeneration(streamingId);
    this.streamManager.closeSession(streamingId);
  }
  
  /**
   * Handle error from Python script or process
   */
  private handleError(streamingId: string, errorMessage: string, errorCode?: string): void {
    this.logger.error('Podcast generation error', { streamingId, errorMessage, errorCode });
    
    // Send error event
    this.streamManager.broadcast(streamingId, {
      type: 'error',
      error: errorCode ? `${errorMessage} (${errorCode})` : errorMessage,
      streamingId,
      timestamp: new Date().toISOString(),
    });
    
    // Clean up
    this.cleanupGeneration(streamingId);
  }
  
  /**
   * Handle process exit
   */
  private handleProcessExit(streamingId: string, code: number | null, signal: string | null): void {
    const activeGeneration = this.activeGenerations.get(streamingId);
    
    if (!activeGeneration) {
      return; // Already cleaned up
    }
    
    const duration = Date.now() - activeGeneration.startTime;
    
    this.logger.info('Python process exited', { 
      streamingId, 
      exitCode: code, 
      signal, 
      duration: `${duration}ms` 
    });
    
    // If process exited with non-zero code and we haven't sent completion, it's an error
    if (code !== 0 && code !== null) {
      this.handleError(
        streamingId,
        `Python script exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`,
        'PROCESS_EXIT_ERROR'
      );
    } else {
      // Normal exit - clean up if not already done
      this.cleanupGeneration(streamingId);
    }
  }
  
  /**
   * Handle process spawn error
   */
  private handleProcessError(streamingId: string, error: Error): void {
    this.logger.error('Python process error', error, { streamingId });
    this.handleError(streamingId, `Process error: ${error.message}`, 'PROCESS_SPAWN_ERROR');
  }
  
  /**
   * Handle generation timeout
   */
  private handleTimeout(streamingId: string): void {
    this.logger.warn('Podcast generation timed out', { streamingId, timeoutMs: this.TIMEOUT_MS });
    
    const activeGeneration = this.activeGenerations.get(streamingId);
    if (activeGeneration && !activeGeneration.process.killed) {
      activeGeneration.process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!activeGeneration.process.killed) {
          activeGeneration.process.kill('SIGKILL');
        }
      }, 5000);
    }
    
    this.handleError(streamingId, 'Podcast generation timed out', 'TIMEOUT_ERROR');
  }
  
  /**
   * Send progress update to client
   */
  private sendProgress(streamingId: string, message: PodcastProgressMessage): void {
    this.streamManager.broadcast(streamingId, message);
  }
  
  /**
   * Clean up generation resources
   */
  private cleanupGeneration(streamingId: string): void {
    const activeGeneration = this.activeGenerations.get(streamingId);
    
    if (!activeGeneration) {
      return;
    }
    
    // Clear timeout
    if (activeGeneration.timeoutHandle) {
      clearTimeout(activeGeneration.timeoutHandle);
    }
    
    // Clean up config file
    unlink(activeGeneration.configFilePath).catch((error) => {
      this.logger.warn('Failed to clean up config file', { 
        configFilePath: activeGeneration.configFilePath,
        error: error.message 
      });
    });
    
    // Remove from active generations
    this.activeGenerations.delete(streamingId);
    
    this.logger.debug('Cleaned up generation', { streamingId });
  }
  
  /**
   * Get count of active generations
   */
  public getActiveGenerationCount(): number {
    return this.activeGenerations.size;
  }
  
  /**
   * Get active generation IDs
   */
  public getActiveGenerationIds(): string[] {
    return Array.from(this.activeGenerations.keys());
  }
  
  /**
   * Cleanup all active generations (useful for graceful shutdown)
   */
  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up all active podcast generations', { 
      activeCount: this.activeGenerations.size 
    });
    
    const cleanupPromises: Promise<void>[] = [];
    
    for (const streamingId of this.activeGenerations.keys()) {
      cleanupPromises.push(
        new Promise<void>((resolve) => {
          this.cancelGeneration(streamingId);
          resolve();
        })
      );
    }
    
    await Promise.all(cleanupPromises);
    
    this.logger.info('All podcast generations cleaned up');
  }
}