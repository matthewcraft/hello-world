import WebSocket from 'ws';
import { config } from './config.js';

export type OpenAIRealtimeOptions = {
  systemPrompt: string;
  voice?: string;
};

export type OpenAIRealtime = {
  socket: WebSocket;
  send: (data: any) => void;
  close: () => void;
};

export function createOpenAIRealtimeSession(opts: OpenAIRealtimeOptions): Promise<OpenAIRealtime> {
  return new Promise((resolve, reject) => {
    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.openai.realtimeModel)}`;
    const socket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    const send = (data: any) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    };

    socket.on('open', () => {
      // Configure session: turn detection and voice
      send({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          turn_detection: { type: 'server_vad', silence_duration_ms: 600 },
          input_audio_format: { type: 'pcm16', sample_rate_hz: 16000 },
          output_audio_format: { type: 'pcm16', sample_rate_hz: 16000 },
          instructions: opts.systemPrompt,
          voice: opts.voice ?? config.openai.voice,
        },
      });
      resolve({ socket, send, close: () => socket.close() });
    });

    socket.on('error', (err) => reject(err));
  });
}