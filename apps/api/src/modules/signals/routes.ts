import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../../auth.js';
import { redis } from '../../realtime/redis.js';
import { emitToUser, getPresenceSnapshot } from '../../realtime/presence.js';
import { areAccepted, getPermissions } from '../privacy/repository.js';
import { acknowledgeSignal, createSignal, getSignal, listInbox } from './repository.js';
import { findDisplayNameById } from '../users/repository.js';
import { sendSignalPush } from '../devices/push.js';

export const signalsRouter = Router();
signalsRouter.use(requireAuth);

const sendSchema = z.object({
  recipientId: z.string().uuid(),
  kind: z.enum(['THINKING_OF_YOU', 'AROUND', 'WAVE']),
});

async function consumeRateLimit(senderId: string, recipientId: string): Promise<boolean> {
  const key = `signals:rate:${senderId}:${recipientId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 600);
  return count <= 5;
}

signalsRouter.get('/inbox', async (req: AuthRequest, res) => {
  res.json({ signals: await listInbox(req.userId!, 30) });
});

signalsRouter.post('/', async (req: AuthRequest, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid signal' });
  const { recipientId, kind } = parsed.data;
  const senderId = req.userId!;
  if (recipientId === senderId) return res.status(400).json({ error: 'You cannot signal yourself' });
  if (!(await areAccepted(recipientId, senderId))) return res.status(404).json({ error: 'Accepted connection not found' });

  const recipientPrivacy = await getPermissions(recipientId, senderId);
  if (!recipientPrivacy.allowSignals) return res.status(403).json({ error: 'This person is not accepting signals from you' });
  if (!(await consumeRateLimit(senderId, recipientId))) {
    return res.status(429).json({ error: 'Signal limit reached. Give them a little space.' });
  }

  const signal = await createSignal(senderId, recipientId, kind);
  const senderDisplayName = await findDisplayNameById(senderId);
  const displayName = senderDisplayName ?? 'Someone';
  emitToUser(recipientId, 'signal:received', { ...signal, senderDisplayName: displayName });
  const recipientPresence = await getPresenceSnapshot(recipientId);
  if (recipientPresence.connectionState === 'BACKGROUND' || recipientPresence.connectionState === 'OFFLINE') {
    void sendSignalPush(recipientId, displayName, kind);
  }
  res.status(201).json({ signal });
});

signalsRouter.post('/:id/acknowledge', async (req: AuthRequest, res) => {
  const existing = await getSignal(req.params.id);
  if (!existing || existing.recipientId !== req.userId) return res.status(404).json({ error: 'Signal not found' });
  const signal = await acknowledgeSignal(existing.id, req.userId!);
  if (!signal) return res.status(404).json({ error: 'Signal not found' });
  emitToUser(signal.senderId, 'signal:acknowledged', signal);
  res.json({ signal });
});
