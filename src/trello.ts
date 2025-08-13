import type { Express, Request, Response } from 'express';
import fetch from 'node-fetch';
import { config } from './config.js';
import { placeCall } from './twilio.js';

const trelloApiBase = 'https://api.trello.com/1';

async function trelloGet<T = any>(path: string): Promise<T> {
  const url = `${trelloApiBase}${path}${path.includes('?') ? '&' : '?'}key=${config.trello.key}&token=${config.trello.token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Trello GET ${path} failed: ${res.status}`);
  const json = await res.json();
  return json as T;
}

async function trelloPost<T = any>(path: string, body?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = `${trelloApiBase}${path}${path.includes('?') ? '&' : '?'}key=${config.trello.key}&token=${config.trello.token}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : null });
  if (!res.ok) throw new Error(`Trello POST ${path} failed: ${res.status}`);
  const json = await res.json();
  return json as T;
}

async function moveCardToList(cardId: string, listId: string) {
  await trelloPost(`/cards/${cardId}`, { idList: listId });
}

export function registerTrelloRoutes(app: Express) {
  // Webhook verification: Trello may send a HEAD request
  app.head('/trello/webhook', (_req: Request, res: Response) => {
    res.sendStatus(200);
  });

  app.post('/trello/webhook', async (req: Request, res: Response) => {
    // Minimal handler to react to card moved/created
    try {
      const action = req.body?.action;
      if (action?.type && (action.type === 'createCard' || action.type === 'updateCard')) {
        const card = action.data?.card;
        const listAfter = action.data?.listAfter?.id as string | undefined;
        if (card?.id && listAfter === config.trello.listToCallId) {
          // Trigger call for this card
          const number = await extractPhoneFromCard(card.id);
          if (number) {
            await moveCardToList(card.id, config.trello.listInProgressId);
            await placeCall({ to: number, cardId: card.id });
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('trello webhook error', err);
    }
    res.sendStatus(200);
  });
}

export function startTrelloPoller() {
  const intervalMs = 30_000;
  // eslint-disable-next-line no-console
  console.log(`Starting Trello poller every ${intervalMs}ms`);
  setInterval(async () => {
    try {
      const cards = await trelloGet<any[]>(`/lists/${config.trello.listToCallId}/cards`);
      for (const card of cards) {
        const number = await extractPhoneFromCard(card.id);
        if (!number) continue;
        // Move to in-progress and dial
        await moveCardToList(card.id, config.trello.listInProgressId);
        await placeCall({ to: number, cardId: card.id });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('trello poller error', err);
    }
  }, intervalMs);
}

async function extractPhoneFromCard(cardId: string): Promise<string | undefined> {
  // Try custom fields first
  try {
    const customFields = await trelloGet<any[]>(`/cards/${cardId}/customFieldItems`);
    const phoneField = customFields.find((f) => f.value?.text || f.value?.phone || f.value?.number);
    if (phoneField) {
      const v = phoneField.value?.text ?? phoneField.value?.phone ?? phoneField.value?.number;
      if (typeof v === 'string') return v.trim();
    }
  } catch {}

  // Fallback: check description
  try {
    const card = await trelloGet<any>(`/cards/${cardId}`);
    const desc: string = card?.desc ?? '';
    const match = desc.match(/\+?\d[\d\s\-().]{6,}/);
    if (match) return match[0].replace(/[^\d+]/g, '');
  } catch {}

  return undefined;
}