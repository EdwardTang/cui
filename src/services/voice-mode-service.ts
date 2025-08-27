import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';

export interface VoiceModeConfig {
  enabled?: boolean;
  debug?: boolean;
  saveAll?: boolean;
  providers?: {
    whisper?: string;
    tts?: string;
  };
}

export class VoiceModeService extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: VoiceModeConfig;
  private isRunning: boolean = false;

  constructor(config: VoiceModeConfig = {}) {
    super();
    this.config = {
      enabled: true,
      debug: false,
      saveAll: false,
      ...config
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Voice Mode service is already running');
      return;
    }

    try {
      const voiceModePath = path.join(process.cwd(), 'voice-mode');
      
      // Set up environment variables
      const env: Record<string, string> = {
        ...process.env,
        VOICEMODE_SAVE_ALL: this.config.saveAll ? 'true' : 'false',
        VOICEMODE_DEBUG: this.config.debug ? 'trace' : 'info',
      };

      // Add provider configuration if specified
      if (this.config.providers?.whisper) {
        env.VOICEMODE_WHISPER_ENDPOINT = this.config.providers.whisper;
      }
      if (this.config.providers?.tts) {
        env.VOICEMODE_TTS_ENDPOINT = this.config.providers.tts;
      }

      // Start the Voice Mode MCP server
      this.process = spawn('uv', ['run', 'voice-mode'], {
        cwd: voiceModePath,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdout?.on('data', (data) => {
        const message = data.toString();
        this.emit('output', message);
        if (this.config.debug) {
          console.log('[Voice Mode]:', message.trim());
        }
      });

      this.process.stderr?.on('data', (data) => {
        const message = data.toString();
        this.emit('error', message);
        console.error('[Voice Mode Error]:', message.trim());
      });

      this.process.on('close', (code) => {
        this.isRunning = false;
        this.emit('close', code);
        console.log(`Voice Mode process exited with code ${code}`);
      });

      this.process.on('error', (error) => {
        this.isRunning = false;
        this.emit('error', error.message);
        console.error('Failed to start Voice Mode:', error);
      });

      // Wait a moment to ensure the process starts
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (this.process && !this.process.killed) {
        this.isRunning = true;
        this.emit('started');
        console.log('Voice Mode service started successfully');
      }
    } catch (error) {
      this.isRunning = false;
      throw new Error(`Failed to start Voice Mode service: ${error}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.process) {
      console.log('Voice Mode service is not running');
      return;
    }

    return new Promise((resolve) => {
      if (this.process) {
        this.process.once('close', () => {
          this.isRunning = false;
          this.emit('stopped');
          console.log('Voice Mode service stopped');
          resolve();
        });

        this.process.kill('SIGTERM');
        
        // Force kill after 5 seconds if not terminated
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
      } else {
        resolve();
      }
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getStatus(): { running: boolean; pid?: number } {
    return {
      running: this.isRunning,
      pid: this.process?.pid
    };
  }

  updateConfig(config: Partial<VoiceModeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Send a message to the Voice Mode MCP server via stdin
  async sendMessage(message: any): Promise<void> {
    if (!this.isRunning || !this.process?.stdin) {
      throw new Error('Voice Mode service is not running');
    }

    const jsonMessage = JSON.stringify(message) + '\n';
    this.process.stdin.write(jsonMessage);
  }

  // Check if Voice Mode dependencies are installed
  static async checkDependencies(): Promise<{ installed: boolean; missing: string[] }> {
    const missing: string[] = [];
    
    try {
      // Check for uv
      const { execSync } = require('child_process');
      try {
        execSync('which uv', { stdio: 'ignore' });
      } catch {
        missing.push('uv');
      }

      // Check for Voice Mode directory
      const fs = require('fs');
      const voiceModePath = path.join(process.cwd(), 'voice-mode');
      if (!fs.existsSync(voiceModePath)) {
        missing.push('voice-mode directory');
      }

      // Check for Voice Mode Python environment
      const venvPath = path.join(voiceModePath, '.venv');
      if (!fs.existsSync(venvPath)) {
        missing.push('voice-mode Python environment');
      }

      return {
        installed: missing.length === 0,
        missing
      };
    } catch (error) {
      return {
        installed: false,
        missing: ['unknown error checking dependencies']
      };
    }
  }

  // Install Voice Mode dependencies
  static async installDependencies(): Promise<void> {
    const { execSync } = require('child_process');
    
    // Install uv if not present
    try {
      execSync('which uv', { stdio: 'ignore' });
    } catch {
      console.log('Installing uv package manager...');
      execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', { stdio: 'inherit' });
    }

    // Install Voice Mode Python dependencies
    const voiceModePath = path.join(process.cwd(), 'voice-mode');
    console.log('Installing Voice Mode Python dependencies...');
    execSync('uv sync', { cwd: voiceModePath, stdio: 'inherit' });
  }
}

// Export a singleton instance
export const voiceModeService = new VoiceModeService();