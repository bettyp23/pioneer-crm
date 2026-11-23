// Fixed-window rate limiter kept in memory. The app runs as one container on the VPS, so one
// process sees every request. Limits apply before the key is checked (slows key guessing too).

export type RateLimiter = { allow(key: string, now?: number): boolean };

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const hits = new Map<string, { start: number; count: number }>();
  return {
    allow(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || now - entry.start >= windowMs) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
          if (hits.size >= maxKeys) return false;
        }
        hits.set(key, { start: now, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}
