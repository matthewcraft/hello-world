import type { Express, Request, Response } from 'express';
import Twilio from 'twilio';
import { config } from './config.js';

const twilioClient = Twilio(config.twilio.accountSid, config.twilio.authToken);

export function registerTwilioRoutes(app: Express) {
  app.post('/twilio/voice', async (req: Request, res: Response) => {
    const callSid = req.body.CallSid as string | undefined;
    const from = req.body.From as string | undefined;
    const cardId = (req.query.cardId as string | undefined) ?? (req.body.cardId as string | undefined);

    const wsUrl = `${config.publicBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/twilio?callSid=${encodeURIComponent(callSid ?? '')}&cardId=${encodeURIComponent(cardId ?? '')}`;

    const twiml = new Twilio.twiml.VoiceResponse();
    const connect = twiml.connect();
    // Bidirectional Media Streams (enable both_tracks to send audio back)
    connect.stream({ url: wsUrl, track: 'both_tracks' as any });

    // Optional greeting while stream boots up
    if (!from) {
      twiml.say({ voice: 'Polly.Matthew' }, 'Connecting you now.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  });

  app.post('/twilio/status', async (req: Request, res: Response) => {
    // Handle call status events for metrics or moving Trello cards
    // eslint-disable-next-line no-console
    console.log('Twilio status:', req.body.CallSid, req.body.CallStatus);
    res.sendStatus(200);
  });
}

export async function placeCall({ to, cardId }: { to: string; cardId?: string }) {
  const url = new URL('/twilio/voice', config.publicBaseUrl);
  if (cardId) url.searchParams.set('cardId', cardId);

  const call = await twilioClient.calls.create({
    to,
    from: config.twilio.voiceNumber,
    url: url.toString(),
    statusCallback: new URL('/twilio/status', config.publicBaseUrl).toString(),
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    method: 'POST',
  });
  return call;
}