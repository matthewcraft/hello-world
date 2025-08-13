# Voice Agents with Trello + Twilio + OpenAI Realtime

A Node.js service that:
- Watches a Trello list for phone call tasks
- Places outbound calls via Twilio
- Streams call audio to OpenAI Realtime for live transcription + response
- Streams AI audio back to the caller

## Prerequisites
- Twilio account with Programmable Voice and Media Streams enabled
- Public HTTPS/WSS URL (e.g. ngrok, Cloudflare Tunnel)
- Trello API key and token
- OpenAI API key with Realtime access

## Setup
1. Copy `.env.example` to `.env` and fill values
2. Install deps and start

```bash
npm install
npm run dev
```

Expose your server publicly and set `PUBLIC_BASE_URL` to that URL.

## Trello
- Create a board with lists: To Call, In Progress, Done
- Put phone numbers in a custom field named "Phone" or in the card description
- Configure a webhook to `POST {PUBLIC_BASE_URL}/trello/webhook` for your board

## Twilio
- Buy/setup a voice number
- Configure a TwiML App or set the voice webhook to `POST {PUBLIC_BASE_URL}/twilio/voice`
- Ensure Media Streams are enabled

## Development
- Health: `GET /health`
- Voice webhook: `POST /twilio/voice`
- Trello webhook: `POST /trello/webhook`

Notes: The audio bridge uses basic resampling and mu-law conversions; quality is sufficient for prototyping.
