import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { connectionsRouter } from './modules/connections/routes.js';
import { spaceRouter } from './modules/space/routes.js';
import { privacyRouter } from './modules/privacy/routes.js';
import { signalsRouter } from './modules/signals/routes.js';
import { devicesRouter } from './modules/devices/routes.js';

export const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'dot-space-api', version: '0.8.0' }));
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/connections', connectionsRouter);
app.use('/space', spaceRouter);
app.use('/privacy', privacyRouter);
app.use('/signals', signalsRouter);
app.use('/devices', devicesRouter);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
