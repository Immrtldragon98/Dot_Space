import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createUser, findUserByEmail, toPublicUser } from '../users/repository.js';
import { signToken } from '../../auth.js';
import { createSession } from '../devices/repository.js';

export const authRouter = Router();
const credentials = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});
const registerSchema = credentials.extend({ displayName: z.string().min(1).max(50) });

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid registration data', details: parsed.error.flatten() });
  const { email, password, displayName } = parsed.data;
  if (await findUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser(email, displayName, passwordHash);
  const session = await createSession(user.id);
  res.status(201).json({ token: signToken(user.id, session.id), user: toPublicUser(user), sessionId: session.id });
});

authRouter.post('/login', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid login data' });
  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const session = await createSession(user.id);
  res.json({ token: signToken(user.id, session.id), user: toPublicUser(user), sessionId: session.id });
});
