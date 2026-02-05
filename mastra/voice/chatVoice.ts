import { DeepgramVoice } from '@mastra/voice-deepgram';

/**
 * Chat Voice Provider for Getflowetic
 * Uses Deepgram API for speech-to-text
 * Available to all users during beta
 */
export const chatVoice = new DeepgramVoice({
  listeningModel: {
    name: 'nova-2',
    apiKey: process.env.DEEPGRAM_API_KEY,
    properties: {
      punctuate: true,
      smart_format: true,
      diarize: false,
      language: 'en',
    },
  },
  speaker: 'asteria-en',
});

export function isVoiceConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}
