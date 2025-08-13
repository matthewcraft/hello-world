import type { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import { createOpenAIRealtimeSession } from './openaiRealtime.js';
import { muLawDecode, muLawEncode, upsample8kTo16kLinear, downsample16kTo8kDecimate, int16ToBase64, base64ToBuffer } from './audio.js';
import { config } from './config.js';

// Twilio media frame duration is typically 20ms, mu-law 8k, base64 payload per message
// We forward audio to OpenAI Realtime as 16k PCM16 frames

type TwilioWsEvent =
  | { event: 'start'; start: { streamSid: string } }
  | { event: 'media'; media: { payload: string }; streamSid: string }
  | { event: 'stop' }
  | { event: 'mark'; mark: { name: string }; streamSid: string };

export function attachTwilioStreamWs(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws/twilio' });

  wss.on('connection', async (twilioSocket, req) => {
    const params = new URLSearchParams((req.url?.split('?')[1]) ?? '');
    const callSid = params.get('callSid') ?? '';
    const cardId = params.get('cardId') ?? '';

    // eslint-disable-next-line no-console
    console.log('Twilio WS connected', { callSid, cardId });

    const systemPrompt = `${config.agent.systemPrompt}`;

    let openai = await createOpenAIRealtimeSession({ systemPrompt });

    // When OpenAI produces audio, forward to Twilio (encode to mu-law 8k)
    openai.socket.on('message', (data: RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'response.output_audio.delta' && msg.audio) {
          const pcm16 = new Int16Array(base64ToBuffer(msg.audio).buffer);
          const pcm8k = downsample16kTo8kDecimate(pcm16);
          const mulaw = muLawEncode(pcm8k);
          const payload = mulaw.toString('base64');
          const streamSid = currentStreamSid ?? '';
          if (streamSid) {
            const out = { event: 'media', streamSid, media: { payload } } as any;
            if (twilioSocket.readyState === WebSocket.OPEN) {
              twilioSocket.send(JSON.stringify(out));
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('OpenAI msg error', err);
      }
    });

    openai.socket.on('close', () => {
      try { twilioSocket.close(); } catch {}
    });

    let currentStreamSid: string | null = null;
    let lastSpeechMs = Date.now();
    let speechActive = false;

    const commitIfSilence = () => {
      const now = Date.now();
      if (speechActive && now - lastSpeechMs > 700) {
        // Commit current buffer and request a response
        openai.send({ type: 'input_audio_buffer.commit' });
        openai.send({ type: 'response.create' });
        speechActive = false;
      }
    };

    const silenceTimer = setInterval(commitIfSilence, 200);

    twilioSocket.on('message', (raw) => {
      try {
        const evt: TwilioWsEvent = JSON.parse(raw.toString());
        if (evt.event === 'start') {
          currentStreamSid = (evt as any).start?.streamSid ?? null;
        }
        if (evt.event === 'media') {
          const base64 = evt.media.payload;
          const mu = base64ToBuffer(base64);
          const pcm8 = muLawDecode(mu);
          // Simple voice activity: compute average abs amplitude
          let sum = 0;
          for (let i = 0; i < pcm8.length; i++) sum += Math.abs(pcm8[i]!);
          const avg = sum / pcm8.length;
          if (avg > 500) {
            speechActive = true;
            lastSpeechMs = Date.now();
          }
          const pcm16 = upsample8kTo16kLinear(pcm8);
          const audioB64 = int16ToBase64(pcm16);
          openai.send({ type: 'input_audio_buffer.append', audio: audioB64 });
        }
        if (evt.event === 'stop') {
          // End session
          try { openai.close(); } catch {}
          try { clearInterval(silenceTimer); } catch {}
          try { twilioSocket.close(); } catch {}
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Twilio WS parse error', err);
      }
    });

    twilioSocket.on('close', () => {
      try { openai.close(); } catch {}
      try { clearInterval(silenceTimer); } catch {}
    });
  });
}