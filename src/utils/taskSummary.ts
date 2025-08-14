/**
 * Task Summary Utility for Podcast Generation
 * Generates dual-host scripts and show notes with structured metadata
 */

import { PodcastSpeaker, PodcastChapter, PodcastTheme, PodcastMetadata, PodcastMetadataSerializer, PODCAST_THEMES } from '@/types/podcast.js';
import { createLogger } from '@/services/logger.js';

const logger = createLogger('TaskSummary');

export interface TaskSummaryOptions {
  includeIntroduction?: boolean;
  includeConclusion?: boolean;
  maxChapters?: number;
  conversationStyle?: 'formal' | 'casual' | 'educational' | 'interview';
  targetDuration?: number; // Target duration in seconds
}

export interface GeneratedScript {
  fullScript: string;
  speakers: PodcastSpeaker[];
  chapters: PodcastChapter[];
  showNotes: string;
  metadata: Record<string, any>;
}

export class TaskSummaryGenerator {
  /**
   * Generate a dual-host podcast script from task content
   */
  static generatePodcastScript(
    content: string,
    title: string,
    theme: PodcastTheme,
    options: TaskSummaryOptions = {}
  ): GeneratedScript {
    logger.debug('Generating podcast script', {
      contentLength: content.length,
      title,
      theme: theme.name,
      options,
    });

    const {
      includeIntroduction = true,
      includeConclusion = true,
      maxChapters = 5,
      conversationStyle = 'casual',
      targetDuration = 300, // 5 minutes default
    } = options;

    // Create speakers based on theme
    const speakers = this.createSpeakers(theme, conversationStyle);
    
    // Analyze content and create chapters
    const chapters = this.generateChapters(content, title, maxChapters, targetDuration);
    
    // Generate the conversation script
    const script = this.generateConversationScript(
      content,
      title,
      speakers,
      chapters,
      conversationStyle,
      { includeIntroduction, includeConclusion }
    );
    
    // Generate show notes
    const showNotes = this.generateShowNotes(title, content, chapters, speakers);
    
    // Create metadata
    const metadata = {
      generatedAt: new Date().toISOString(),
      contentLength: content.length,
      scriptLength: script.length,
      estimatedDuration: this.estimateDuration(script),
      theme: theme.name,
      style: conversationStyle,
    };

    logger.debug('Script generation completed', {
      scriptLength: script.length,
      chaptersGenerated: chapters.length,
      estimatedDuration: metadata.estimatedDuration,
    });

    return {
      fullScript: script,
      speakers,
      chapters,
      showNotes,
      metadata,
    };
  }

  /**
   * Create speakers based on theme and style
   */
  private static createSpeakers(theme: PodcastTheme, style: string): PodcastSpeaker[] {
    const voiceA = process.env.PODCAST_EN_VOICE_A || 'Alloy';
    const voiceB = process.env.PODCAST_EN_VOICE_B || 'Verse';

    const personalities = this.getSpeakerPersonalities(style);

    return [
      {
        name: 'Alex',
        voice: voiceA,
        role: 'host',
        personality: personalities.primary,
      },
      {
        name: 'Sam',
        voice: voiceB,
        role: 'host',
        personality: personalities.secondary,
      },
    ];
  }

  /**
   * Get speaker personalities based on conversation style
   */
  private static getSpeakerPersonalities(style: string): { primary: any; secondary: any } {
    switch (style) {
      case 'formal':
        return { primary: 'formal', secondary: 'analytical' };
      case 'educational':
        return { primary: 'analytical', secondary: 'formal' };
      case 'interview':
        return { primary: 'formal', secondary: 'casual' };
      default: // casual
        return { primary: 'casual', secondary: 'enthusiastic' };
    }
  }

  /**
   * Generate chapter structure from content
   */
  private static generateChapters(
    content: string,
    title: string,
    maxChapters: number,
    targetDuration: number
  ): PodcastChapter[] {
    logger.debug('Generating chapters', { maxChapters, targetDuration });

    // Extract key topics from content
    const topics = this.extractTopics(content);
    const chapterCount = Math.min(topics.length + 2, maxChapters); // +2 for intro/outro
    
    const chapters: PodcastChapter[] = [];
    const avgChapterDuration = targetDuration / chapterCount;

    // Introduction chapter
    chapters.push({
      title: 'Introduction',
      startTime: 0,
      duration: Math.round(avgChapterDuration * 0.8),
      description: `Welcome and overview of ${title}`,
      topics: ['introduction', 'overview'],
      keyPoints: ['Welcome listeners', 'Introduce topic', 'Set expectations'],
    });

    // Main content chapters
    let currentTime = chapters[0].duration;
    topics.slice(0, maxChapters - 2).forEach((topic, index) => {
      const duration = Math.round(avgChapterDuration * (0.9 + Math.random() * 0.2));
      chapters.push({
        title: this.formatTopicAsTitle(topic),
        startTime: currentTime,
        duration,
        description: `Discussion about ${topic.toLowerCase()}`,
        topics: [topic.toLowerCase()],
        keyPoints: this.generateKeyPoints(topic),
      });
      currentTime += duration;
    });

    // Conclusion chapter
    if (chapters.length < maxChapters) {
      chapters.push({
        title: 'Conclusion',
        startTime: currentTime,
        duration: targetDuration - currentTime,
        description: 'Summary and final thoughts',
        topics: ['conclusion', 'summary'],
        keyPoints: ['Recap key points', 'Final thoughts', 'Thank listeners'],
      });
    }

    return chapters;
  }

  /**
   * Extract main topics from content
   */
  private static extractTopics(content: string): string[] {
    // Simple topic extraction - in production, this could use NLP
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const topics = [];

    // Look for common topic indicators
    const topicPatterns = [
      /(?:about|discuss|regarding|concerning)\s+([^,\.]+)/gi,
      /(?:the|a|an)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /(?:how|what|why|when|where)\s+([^,\.]+)/gi,
    ];

    for (const sentence of sentences.slice(0, 10)) {
      for (const pattern of topicPatterns) {
        const matches = sentence.match(pattern);
        if (matches) {
          topics.push(...matches.slice(0, 2));
        }
      }
    }

    // Fallback topics if extraction fails
    if (topics.length === 0) {
      topics.push('Main Discussion', 'Key Points', 'Analysis');
    }

    return topics.slice(0, 5).map(topic => this.cleanTopic(topic));
  }

  /**
   * Clean and format topic text
   */
  private static cleanTopic(topic: string): string {
    return topic
      .replace(/^(?:about|discuss|regarding|concerning|the|a|an|how|what|why|when|where)\s+/i, '')
      .trim()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .substring(0, 50);
  }

  /**
   * Format topic as chapter title
   */
  private static formatTopicAsTitle(topic: string): string {
    return topic.length > 30 ? topic.substring(0, 27) + '...' : topic;
  }

  /**
   * Generate key points for a topic
   */
  private static generateKeyPoints(topic: string): string[] {
    return [
      `Understanding ${topic}`,
      `Key aspects of ${topic}`,
      `Practical applications`,
    ];
  }

  /**
   * Generate conversation script
   */
  private static generateConversationScript(
    content: string,
    title: string,
    speakers: PodcastSpeaker[],
    chapters: PodcastChapter[],
    style: string,
    options: { includeIntroduction: boolean; includeConclusion: boolean }
  ): string {
    const [speaker1, speaker2] = speakers;
    let script = '';

    // Build script for each chapter
    chapters.forEach((chapter, index) => {
      script += `\n[${chapter.title}]\n\n`;

      if (index === 0 && options.includeIntroduction) {
        // Introduction
        script += `${speaker1.name}: Welcome to our discussion about ${title}. I'm ${speaker1.name}, and I'm here with ${speaker2.name}.\n\n`;
        script += `${speaker2.name}: Thanks ${speaker1.name}! Today we're diving into some fascinating topics. Let's start with ${chapter.keyPoints?.[1] || 'the basics'}.\n\n`;
      } else if (index === chapters.length - 1 && options.includeConclusion) {
        // Conclusion
        script += `${speaker1.name}: As we wrap up our discussion, ${speaker2.name}, what are your key takeaways?\n\n`;
        script += `${speaker2.name}: Great question! The main points I'd highlight are the insights we covered about ${title}. Thanks for listening!\n\n`;
      } else {
        // Regular chapter
        script += this.generateChapterScript(chapter, speakers, content, style);
      }
    });

    return script.trim();
  }

  /**
   * Generate script for a specific chapter
   */
  private static generateChapterScript(
    chapter: PodcastChapter,
    speakers: PodcastSpeaker[],
    content: string,
    style: string
  ): string {
    const [speaker1, speaker2] = speakers;
    let script = '';

    // Estimate how much content this chapter should cover
    const contentSnippet = content.substring(0, 200); // Sample content

    switch (style) {
      case 'formal':
        script += `${speaker1.name}: Let's examine ${chapter.title} in detail.\n\n`;
        script += `${speaker2.name}: Indeed. The key aspects we should consider include ${chapter.keyPoints?.[0] || 'the fundamental concepts'}.\n\n`;
        break;
      case 'educational':
        script += `${speaker1.name}: Now, let's learn about ${chapter.title}. ${speaker2.name}, can you explain the basics?\n\n`;
        script += `${speaker2.name}: Absolutely! ${chapter.title} involves several important concepts that we should understand...\n\n`;
        break;
      case 'interview':
        script += `${speaker1.name}: ${speaker2.name}, tell us about ${chapter.title}.\n\n`;
        script += `${speaker2.name}: Well, ${speaker1.name}, ${chapter.title} is particularly interesting because...\n\n`;
        break;
      default: // casual
        script += `${speaker1.name}: So, ${speaker2.name}, what's the deal with ${chapter.title}?\n\n`;
        script += `${speaker2.name}: Oh, that's a great question! ${chapter.title} is actually pretty fascinating when you think about it...\n\n`;
        break;
    }

    return script;
  }

  /**
   * Generate show notes
   */
  private static generateShowNotes(
    title: string,
    content: string,
    chapters: PodcastChapter[],
    speakers: PodcastSpeaker[]
  ): string {
    let notes = `# ${title}\n\n`;
    
    notes += `## Hosts\n`;
    speakers.forEach(speaker => {
      notes += `- **${speaker.name}** (${speaker.role})\n`;
    });
    notes += '\n';

    notes += `## Episode Summary\n`;
    notes += `${content.substring(0, 200)}...\n\n`;

    notes += `## Chapters\n`;
    chapters.forEach((chapter, index) => {
      const timestamp = this.formatTimestamp(chapter.startTime);
      notes += `${index + 1}. **${chapter.title}** (${timestamp})\n`;
      if (chapter.description) {
        notes += `   ${chapter.description}\n`;
      }
      if (chapter.keyPoints && chapter.keyPoints.length > 0) {
        chapter.keyPoints.forEach(point => {
          notes += `   - ${point}\n`;
        });
      }
      notes += '\n';
    });

    return notes;
  }

  /**
   * Format timestamp for show notes
   */
  private static formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Estimate duration based on script length
   */
  private static estimateDuration(script: string): number {
    // Rough estimate: ~150 words per minute, average 5 characters per word
    const wordsPerMinute = 150;
    const avgCharsPerWord = 5;
    const estimatedWords = script.length / avgCharsPerWord;
    return Math.round((estimatedWords / wordsPerMinute) * 60); // Return seconds
  }

  /**
   * Create podcast metadata from generated script
   */
  static createMetadataFromScript(
    script: GeneratedScript,
    title: string,
    language: string,
    theme: PodcastTheme,
    generationId: string
  ): PodcastMetadata {
    return PodcastMetadataSerializer.createMetadata(
      title,
      language,
      script.metadata.estimatedDuration || 300,
      script.speakers,
      script.chapters,
      theme,
      generationId
    );
  }
}