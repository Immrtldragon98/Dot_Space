import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: required('JWT_SECRET'),
  presenceTtlSeconds: Number(process.env.PRESENCE_TTL_SECONDS ?? 55),
  presenceSweepMs: Number(process.env.PRESENCE_SWEEP_MS ?? 10000),
};
