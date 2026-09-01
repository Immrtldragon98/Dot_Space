import type { Request, Response, NextFunction } from 'express';
import { redis } from './realtime/redis.js';

function clientKey(req: Request): string {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.ip || 'unknown';
}

export function rateLimit(namespace: string, limit: number, windowSeconds: number) {
  return async function limiter(req: Request, res: Response, next: NextFunction) {
    if (!redis.isReady) return next();
    const key = `ratelimit:${namespace}:${clientKey(req)}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
      if (ttl > 0) res.setHeader('Retry-After', String(ttl));
      if (count > limit) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      next();
    } catch (error) {
      console.error('[rate-limit]', error);
      next();
    }
  };
}
