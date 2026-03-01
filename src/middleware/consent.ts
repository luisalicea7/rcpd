import { createMiddleware } from "hono/factory";
import { redis } from "../config/redis.js";
import { requireSessionId } from "../utils/session-context.js";

export const requireConsent = createMiddleware(async (c, next) => {
  const session = requireSessionId(c);
  if (session instanceof Response) return session;

  let consent: string | null;
  try {
    consent = await redis.get(`session:${session}:consent`);
  } catch {
    return c.json(
      {
        error: "Service unavailable",
        code: "REDIS_UNAVAILABLE",
      },
      503,
    );
  }

  if (consent !== "granted") {
    return c.json(
      { error: "Consent required before tracking", code: "CONSENT_REQUIRED" },
      403,
    );
  }

  await next();
});