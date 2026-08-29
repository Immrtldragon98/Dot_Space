import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { app } from './app.js';
import { config } from './config.js';
import { db } from './db/pool.js';
import { connectRedis, redisPub, redisSub } from './realtime/redis.js';
import { installPresenceRealtime } from './realtime/presence.js';

await db.query('SELECT 1');
await connectRedis();

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: false } });
io.adapter(createAdapter(redisPub, redisSub));
installPresenceRealtime(io);

httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`Dot Space API + Redis presence listening on http://localhost:${config.port}`);
});
