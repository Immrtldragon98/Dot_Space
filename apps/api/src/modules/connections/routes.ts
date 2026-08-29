import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../../auth.js';
import { findUserByEmail } from '../users/repository.js';
import { createConnection, getConnection, listConnectionRequests, setConnectionStatus } from './repository.js';

export const connectionsRouter = Router();
connectionsRouter.use(requireAuth);

connectionsRouter.get('/requests', async (req: AuthRequest, res) => {
  res.json({ requests: await listConnectionRequests(req.userId!) });
});

connectionsRouter.post('/requests', async (req: AuthRequest, res) => {
  const parsed = z.object({ email: z.email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address' });
  const target = await findUserByEmail(parsed.data.email);
  if (!target) return res.status(404).json({ error: 'No Dot Space user found with that email' });
  if (target.id === req.userId) return res.status(400).json({ error: 'You cannot add yourself' });

  const connection = await createConnection(req.userId!, target.id);
  if (connection.status === 'BLOCKED') return res.status(403).json({ error: 'This connection is unavailable' });
  if (connection.status === 'ACCEPTED') return res.status(409).json({ error: 'This person is already in your Space' });
  if (connection.status === 'PENDING' && connection.requester_id !== req.userId) {
    return res.status(409).json({ error: 'This person already sent you a request. Check Requests.' });
  }
  res.status(201).json({ connectionId: connection.id, status: connection.status });
});

connectionsRouter.post('/:id/accept', async (req: AuthRequest, res) => {
  const connection = await getConnection(req.params.id);
  if (!connection || connection.addressee_id !== req.userId || connection.status !== 'PENDING') {
    return res.status(404).json({ error: 'Pending incoming request not found' });
  }
  res.json({ connection: await setConnectionStatus(connection.id, 'ACCEPTED', req.userId!) });
});

connectionsRouter.post('/:id/reject', async (req: AuthRequest, res) => {
  const connection = await getConnection(req.params.id);
  if (!connection || connection.addressee_id !== req.userId || connection.status !== 'PENDING') {
    return res.status(404).json({ error: 'Pending incoming request not found' });
  }
  res.json({ connection: await setConnectionStatus(connection.id, 'REJECTED', req.userId!) });
});

connectionsRouter.post('/:id/block', async (req: AuthRequest, res) => {
  const connection = await getConnection(req.params.id);
  if (!connection || (connection.requester_id !== req.userId && connection.addressee_id !== req.userId)) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  res.json({ connection: await setConnectionStatus(connection.id, 'BLOCKED', req.userId!) });
});
