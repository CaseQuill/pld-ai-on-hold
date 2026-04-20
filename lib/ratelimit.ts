import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type LimitResult = { success: boolean };
type Limiter = { limit: (key: string) => Promise<LimitResult> };

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

if (!hasRedis) {
  console.warn(
    "[pdl-dialer] Upstash Redis not configured — using in-memory fallback. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production."
  );
}

const redis = hasRedis ? Redis.fromEnv() : null;

function inMemoryWindowLimiter(max: number, windowMs: number): Limiter {
  const hits = new Map<string, number[]>();
  return {
    async limit(key: string) {
      const now = Date.now();
      const arr = hits.get(key) ?? [];
      const fresh = arr.filter((t) => now - t < windowMs);
      if (fresh.length >= max) {
        hits.set(key, fresh);
        return { success: false };
      }
      fresh.push(now);
      hits.set(key, fresh);
      return { success: true };
    },
  };
}

export const perIpLimiter: Limiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "pdl:ip",
      analytics: false,
    })
  : inMemoryWindowLimiter(10, 60_000);

export const globalDailyLimiter: Limiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(100, "1 d"),
      prefix: "pdl:global",
      analytics: false,
    })
  : inMemoryWindowLimiter(100, 24 * 60 * 60 * 1000);

let rrCounter = 0;
export async function nextPhnumId(pool: string[]): Promise<string> {
  if (pool.length === 0) throw new Error("Phone number pool is empty");
  if (redis) {
    const idx = await redis.incr("pdl:rr:phnum");
    return pool[(Number(idx) - 1) % pool.length]!;
  }
  const idx = rrCounter++;
  return pool[idx % pool.length]!;
}
