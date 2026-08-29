import { createClient } from 'redis';
import { config } from '../config.js';

export const redis = createClient({ url: config.redisUrl });
export const redisPub = redis.duplicate();
export const redisSub = redis.duplicate();

for (const [name, client] of [['redis', redis], ['redis-pub', redisPub], ['redis-sub', redisSub]] as const) {
  client.on('error', error => console.error(`[${name}]`, error));
}

export async function connectRedis() {
  await Promise.all([redis.connect(), redisPub.connect(), redisSub.connect()]);
}
