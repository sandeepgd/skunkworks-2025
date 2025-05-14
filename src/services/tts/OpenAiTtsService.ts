import OpenAI from 'openai';
import { TtsService, TtsOptions } from './TtsService';

export class OpenAiTtsService implements TtsService {
  private client: OpenAI;
  private readonly defaultVoice = 'alloy';

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async convertToSpeech(text: string, options?: TtsOptions): Promise<Buffer> {
    const mp3 = await this.client.audio.speech.create({
      model: options?.model || 'tts-1',
      voice: options?.voice || this.defaultVoice,
      input: text,
    });

    return Buffer.from(await mp3.arrayBuffer());
  }
} 