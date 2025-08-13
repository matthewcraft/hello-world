import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config.js';
import { registerTwilioRoutes } from './twilio.js';
import { registerTrelloRoutes, startTrelloPoller } from './trello.js';
import { attachTwilioStreamWs } from './realtimeBridge.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

registerTwilioRoutes(app);
registerTrelloRoutes(app);

app.get('/health', (_req, res) => {
  res.send({ ok: true });
});

const server = http.createServer(app);
attachTwilioStreamWs(server);

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${config.port}`);
});

startTrelloPoller();