import { TtsService } from './TtsService';
import { OpenAiTtsService } from './OpenAiTtsService';
import { ElevenLabsTtsService } from './ElevenLabsTtsService';

export type TtsProvider = 'openai' | 'elevenlabs';

export class TtsServiceFactory {
  private static instance: TtsServiceFactory;
  private service: TtsService | null = null;

  private constructor() {}

  static getInstance(): TtsServiceFactory {
    if (!TtsServiceFactory.instance) {
      TtsServiceFactory.instance = new TtsServiceFactory();
    }
    return TtsServiceFactory.instance;
  }

  initializeOpenAi(apiKey: string): void {
    if (this.service) {
      throw new Error('TTS service is already initialized');
    }
    this.service = new OpenAiTtsService(apiKey);
  }

  initializeElevenLabs(apiKey: string): void {
    if (this.service) {
      throw new Error('TTS service is already initialized');
    }
    this.service = new ElevenLabsTtsService(apiKey);
  }

  // Add more initialization methods for other providers here
  // initializeElevenLabs(apiKey: string): void { ... }

  getService(): TtsService {
    if (!this.service) {
      throw new Error('No TTS service has been initialized');
    }
    return this.service;
  }
} 