import type { Context } from "hono";
import { logger } from "./logger.js";

const REDIS_AVAILABILITY_PATTERNS = [
  "redis",
  "econnrefused",
  "connection",
  "connect",
  "socket",
  "timeout",
  "timed out",
  "enotfound",
  "eai_again",
  "closed",
] as const;

export function isRedisUnavailableError(err: unknown): boolean {
  if (!err) return false;

  if (typeof err === "string") {
    const lower = err.toLowerCase();
    return REDIS_AVAILABILITY_PATTERNS.some((pattern) => lower.includes(pattern));
  }

  if (typeof err === "object") {
    const candidate = err as { message?: unknown; code?: unknown; cause?: unknown };
    const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
    const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";

    if (
      REDIS_AVAILABILITY_PATTERNS.some(
        (pattern) => message.includes(pattern) || code.includes(pattern),
      )
    ) {
      return true;
    }

    return isRedisUnavailableError(candidate.cause);
  }

  return false;
}

export function respondRedisUnavailable(
  c: Context,
  err: unknown,
  logMessage: string,
  logMeta?: Record<string, unknown>,
): Response {
  logger.error({ err, path: c.req.path, ...logMeta }, logMessage);
  return c.json({ error: "Service unavailable", code: "REDIS_UNAVAILABLE" }, 503);
}
