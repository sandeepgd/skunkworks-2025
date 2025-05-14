import { ElevenLabsClient } from "elevenlabs";
import { TtsService, TtsOptions } from './TtsService';
import { Readable } from 'stream';

export class ElevenLabsTtsService implements TtsService {
  private client: ElevenLabsClient;
  private readonly voices = [
    'ZT9u07TYPVl83ejeLakq',  // Rachelle
    'BpjGufoPiobT79j2vtj4', // Priyanka Sogam
    'FISo3sWdWP0bALUdgh5x', // Matt
    'kmSVBPu7loj4ayNinwWM', // Archie
    '68Z7Qr44IalOOUuVAR8R', // Aahmed
    'ecp3DWciuUyW7BYM7II1', // Anika
  ];

  constructor(apiKey: string) {
    console.log('Initializing ElevenLabs client with API key:', apiKey.substring(0, 5) + '...');
    this.client = new ElevenLabsClient({ apiKey });
    console.log('ElevenLabs client initialized');
  }

  private getRandomVoice(): string {
    const randomIndex = Math.floor(Math.random() * this.voices.length);
    return this.voices[randomIndex];
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async convertToSpeech(text: string, options?: TtsOptions): Promise<Buffer> {
    try {
      console.log('Converting text to speech with ElevenLabs:', {
        text: text.substring(0, 50) + '...',
        voiceId: options?.voice || this.getRandomVoice(),
        modelId: options?.model || 'eleven_monolingual_v1'
      });

      const audioStream = await this.client.textToSpeech.convert(
        options?.voice || this.getRandomVoice(),
        {
          text,
          model_id: options?.model || 'eleven_monolingual_v1',
          output_format: 'mp3_44100_128'
        }
      );

      if (!audioStream) {
        throw new Error('No audio data returned from ElevenLabs');
      }

      return this.streamToBuffer(audioStream);
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw new Error('Failed to generate speech with ElevenLabs');
    }
  }
} 