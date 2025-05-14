export interface TtsOptions {
  voice?: string;
  model?: string;
  [key: string]: any; // Allow for provider-specific options
}

export interface TtsService {
  convertToSpeech(text: string, options?: TtsOptions): Promise<Buffer>;
} 