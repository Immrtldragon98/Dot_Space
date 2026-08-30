import 'dotenv/config';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasRedisUrl = Boolean(process.env.REDIS_URL);
const hasJwtSecret = Boolean(process.env.JWT_SECRET);

if (!hasDatabaseUrl) console.warn('[config] DATABASE_URL is not configured');
if (!hasRedisUrl) console.warn('[config] REDIS_URL is not configured');
if (!hasJwtSecret) console.warn('[config] JWT_SECRET is not configured; using temporary boot secret');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://dotspace_unconfigured:dotspace_unconfigured@127.0.0.1:5432/dotspace_unconfigured',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'dot-space-unconfigured-boot-secret-change-me',
  presenceTtlSeconds: Number(process.env.PRESENCE_TTL_SECONDS ?? 55),
  presenceSweepMs: Number(process.env.PRESENCE_SWEEP_MS ?? 10000),
  configured: {
    database: hasDatabaseUrl,
    redis: hasRedisUrl,
    jwt: hasJwtSecret,
  },
};
