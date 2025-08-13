import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env var ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  publicBaseUrl: requireEnv('PUBLIC_BASE_URL'),

  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    voiceNumber: requireEnv('TWILIO_VOICE_NUMBER'),
    appSid: process.env.TWILIO_APP_SID ?? '',
  },

  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
    realtimeModel: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-4o-realtime-preview',
    voice: process.env.OPENAI_VOICE ?? 'verse',
  },

  trello: {
    key: requireEnv('TRELLO_KEY'),
    token: requireEnv('TRELLO_TOKEN'),
    boardId: requireEnv('TRELLO_BOARD_ID'),
    listToCallId: requireEnv('TRELLO_LIST_TOCALL_ID'),
    listInProgressId: requireEnv('TRELLO_LIST_INPROGRESS_ID'),
    listDoneId: requireEnv('TRELLO_LIST_DONE_ID'),
  },

  agent: {
    systemPrompt: process.env.AGENT_SYSTEM_PROMPT ?? 'You are a helpful phone agent. Be concise and polite.',
    maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_CALLS ?? '2', 10),
  },
};