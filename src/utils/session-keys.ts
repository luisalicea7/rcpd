import { redis } from "../config/redis.js";
import { config } from "../config/index.js";

export function keyIndexKey(sessionId: string): string {
  return `session:${sessionId}:keys`;
}

export async function trackSessionKey(
  sessionId: string,
  key: string,
): Promise<void> {
  const index = keyIndexKey(sessionId);
  await redis.sadd(index, key);
  await redis.expire(index, config.SESSION_TTL);
}

export async function refreshSessionIndexTtl(sessionId: string): Promise<void> {
  await redis.expire(keyIndexKey(sessionId), config.SESSION_TTL);
}
