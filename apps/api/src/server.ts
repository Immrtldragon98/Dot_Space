import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { app } from './app.js';
import { config } from './config.js';
import { db } from './db/pool.js';
import { connectRedis, redisPub, redisSub } from './realtime/redis.js';
import { installPresenceRealtime } from './realtime/presence.js';

let databaseReady = false;
let redisReady = false;

try {
  await db.query('SELECT 1');
  databaseReady = true;
  console.log('[startup] PostgreSQL ready');
} catch (error) {
  console.error('[startup] PostgreSQL unavailable; API starting in degraded mode', error);
}

try {
  await connectRedis();
  redisReady = true;
  console.log('[startup] Redis ready');
} catch (error) {
  console.error('[startup] Redis unavailable; realtime presence disabled', error);
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: false } });

if (redisReady) {
  io.adapter(createAdapter(redisPub, redisSub));
  installPresenceRealtime(io);
}

app.locals.readiness = { database: databaseReady, redis: redisReady };

httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`Dot Space API listening on http://localhost:${config.port} (db=${databaseReady}, redis=${redisReady})`);
});
