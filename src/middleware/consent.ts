import { createMiddleware } from "hono/factory";
import { redis } from "../config/redis.js";
import { requireSessionId } from "../utils/session-context.js";

export const requireConsent = createMiddleware(async (c, next) => {
  const session = requireSessionId(c);
  if (session instanceof Response) return session;
  const consent = await redis.get(`session:${session}:consent`);

  if (consent !== "granted") {
    return c.json(
      { error: "Consent required before tracking", code: "CONSENT_REQUIRED" },
      403,
    );
  }

  await next();
});