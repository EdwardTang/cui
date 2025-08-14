/**
 * Comprehensive podcast types for CUI Podcast Backend API
 */

// Core podcast generation request types
export interface PodcastGenerationRequest {
  content: string;
  title?: string;
  language?: string;
  voiceA?: string;
  voiceB?: string;
  theme?: PodcastTheme;
  options?: PodcastGenerationOptions;
}

export interface PodcastGenerationOptions {
  maxDuration?: number; // Maximum duration in seconds
  speakerBalance?: number; // 0.0-1.0, balance between speakers
  includeIntro?: boolean;
  includeOutro?: boolean;
  chapters?: boolean; // Whether to generate chapter markers
  customInstructions?: string;
  conversationStyle?: 'formal' | 'casual' | 'educational' | 'interview';
}

// Theme system for podcast styling and behavior
export interface PodcastTheme {
  name: string;
  displayName?: string;
  colors?: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent?: string;
  };
  typography?: {
    fontFamily: string;
    fontSize: string;
  };
  audio?: {
    introMusic?: string;
    outroMusic?: string;
    backgroundMusic?: string;
  };
  voiceSettings?: {
    speed: number; // 0.5-2.0
    pitch: number; // -20 to +20
    emphasis: 'low' | 'medium' | 'high';
  };
}

// Predefined themes
export const PODCAST_THEMES: Record<string, PodcastTheme> = {
  default: {
    name: 'default',
    displayName: 'Default',
    colors: {
      primary: '#3B82F6',
      secondary: '#8B5CF6',
      background: '#FFFFFF',
      text: '#1F2937',
    },
    typography: {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
    },
    voiceSettings: {
      speed: 1.0,
      pitch: 0,
      emphasis: 'medium',
    },
  },
  minimalist: {
    name: 'minimalist',
    displayName: 'Minimalist',
    colors: {
      primary: '#000000',
      secondary: '#666666',
      background: '#F8FAFC',
      text: '#0F172A',
    },
    typography: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
    },
    voiceSettings: {
      speed: 1.1,
      pitch: -2,
      emphasis: 'low',
    },
  },
  professional: {
    name: 'professional',
    displayName: 'Professional',
    colors: {
      primary: '#1E40AF',
      secondary: '#DC2626',
      background: '#FFFFFF',
      text: '#111827',
      accent: '#059669',
    },
    typography: {
      fontFamily: 'Roboto, sans-serif',
      fontSize: '16px',
    },
    voiceSettings: {
      speed: 0.95,
      pitch: 1,
      emphasis: 'medium',
    },
  },
  casual: {
    name: 'casual',
    displayName: 'Casual',
    colors: {
      primary: '#F59E0B',
      secondary: '#EC4899',
      background: '#FEF3C7',
      text: '#92400E',
    },
    typography: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '16px',
    },
    voiceSettings: {
      speed: 1.05,
      pitch: 3,
      emphasis: 'high',
    },
  },
};

// Speaker configuration
export interface PodcastSpeaker {
  name: string;
  voice: string;
  role?: 'host' | 'guest' | 'narrator';
  personality?: 'formal' | 'casual' | 'enthusiastic' | 'analytical';
  accent?: string;
}

// Chapter/segment structure
export interface PodcastChapter {
  title: string;
  startTime: number; // Seconds from beginning
  duration: number; // Duration in seconds
  description?: string;
  topics?: string[];
  keyPoints?: string[];
}

// Comprehensive metadata structure
export interface PodcastMetadata {
  // Basic information
  title: string;
  description?: string;
  language: string;
  duration: number; // Total duration in seconds
  createdAt: string; // ISO timestamp
  
  // Speakers
  speakers: PodcastSpeaker[];
  
  // Content structure
  chapters: PodcastChapter[];
  
  // Theme and styling
  theme: PodcastTheme;
  
  // Technical metadata
  format: 'mp3' | 'wav' | 'ogg';
  bitrate?: number;
  sampleRate?: number;
  channels: number;
  fileSize?: number; // In bytes
  
  // Content metadata
  topics?: string[];
  tags?: string[];
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  
  // Analytics/tracking
  generationId: string; // Unique ID for this generation
  version: string; // API version used
  processingTime?: number; // Time taken to generate (seconds)
}

// API response structure
export interface PodcastGenerationResult {
  success: boolean;
  streamingId: string;
  audioUrl?: string;
  metadata: PodcastMetadata;
  error?: string;
  warnings?: string[];
}

// Progress tracking
export interface PodcastGenerationProgress {
  stage: 'initializing' | 'processing' | 'generating' | 'finalizing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  currentStep?: string;
  estimatedTimeRemaining?: number; // Seconds
  details?: Record<string, any>;
}

// Serialization utilities
export class PodcastMetadataSerializer {
  /**
   * Serialize metadata for API response
   */
  static serialize(metadata: PodcastMetadata): Record<string, any> {
    return {
      title: metadata.title,
      description: metadata.description,
      language: metadata.language,
      duration: metadata.duration,
      createdAt: metadata.createdAt,
      speakers: metadata.speakers.map(speaker => ({
        name: speaker.name,
        voice: speaker.voice,
        role: speaker.role || 'host',
        personality: speaker.personality || 'casual',
      })),
      chapters: metadata.chapters.map(chapter => ({
        title: chapter.title,
        startTime: chapter.startTime,
        duration: chapter.duration,
        description: chapter.description,
        topics: chapter.topics || [],
        keyPoints: chapter.keyPoints || [],
      })),
      theme: {
        name: metadata.theme.name,
        displayName: metadata.theme.displayName,
        colors: metadata.theme.colors,
        typography: metadata.theme.typography,
        voiceSettings: metadata.theme.voiceSettings,
      },
      technical: {
        format: metadata.format,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
        channels: metadata.channels,
        fileSize: metadata.fileSize,
      },
      content: {
        topics: metadata.topics || [],
        tags: metadata.tags || [],
        category: metadata.category,
        difficulty: metadata.difficulty || 'intermediate',
      },
      generation: {
        id: metadata.generationId,
        version: metadata.version,
        processingTime: metadata.processingTime,
      },
    };
  }

  /**
   * Create metadata from basic podcast info
   */
  static createMetadata(
    title: string,
    language: string,
    duration: number,
    speakers: PodcastSpeaker[],
    chapters: PodcastChapter[],
    theme: PodcastTheme,
    generationId: string
  ): PodcastMetadata {
    return {
      title,
      language,
      duration,
      speakers,
      chapters,
      theme,
      format: 'mp3',
      channels: 2,
      createdAt: new Date().toISOString(),
      generationId,
      version: '1.0.0',
    };
  }

  /**
   * Get theme by name or return default
   */
  static getTheme(themeName: string): PodcastTheme {
    return PODCAST_THEMES[themeName] || PODCAST_THEMES.default;
  }

  /**
   * Validate metadata structure
   */
  static validate(metadata: Partial<PodcastMetadata>): boolean {
    const required = ['title', 'language', 'duration', 'speakers', 'chapters', 'theme'];
    return required.every(field => field in metadata && metadata[field as keyof PodcastMetadata] != null);
  }
}