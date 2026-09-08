import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../../auth.js';
import { deleteUser, findUserById, toPublicUser, updateHumanStatus } from './repository.js';
import { getPresenceSnapshot, notifyHumanStatusChanged } from '../../realtime/presence.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', async (req: AuthRequest, res) => {
  const user = await findUserById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: toPublicUser(user), ...(await getPresenceSnapshot(req.userId!)) });
});

const statusSchema = z.object({
  humanStatus: z.enum(['AVAILABLE','QUIET','BUSY','SLEEPING','TRAVELLING','CUSTOM']),
  customStatus: z.string().max(80).nullable().optional(),
  expiresInMinutes: z.number().int().min(5).max(24 * 60).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.humanStatus === 'CUSTOM' && !value.customStatus?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Custom status text is required', path: ['customStatus'] });
  }
});

usersRouter.patch('/me/status', async (req: AuthRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status', details: parsed.error.flatten() });
  const expires = parsed.data.expiresInMinutes ? new Date(Date.now() + parsed.data.expiresInMinutes * 60_000) : null;
  const user = await updateHumanStatus(req.userId!, parsed.data.humanStatus, parsed.data.customStatus?.trim() || null, expires);
  const publicUser = toPublicUser(user);
  await notifyHumanStatusChanged(user.id, publicUser.humanStatus, publicUser.customStatus, publicUser.statusExpiresAt);
  res.json({ user: publicUser });
});

usersRouter.delete('/me', async (req: AuthRequest, res) => {
  const deleted = await deleteUser(req.userId!);
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  res.status(204).end();
});
