import { createMiddleware } from "hono/factory";
import { redis } from "../config/redis.js";

export const requireConsent = createMiddleware(async (c, next) => {
  const sessionId = c.get("sessionId");
  const consent = await redis.get(`session:${sessionId}:consent`);

  if (consent !== "granted") {
    return c.json(
      { error: "Consent required before tracking", code: "CONSENT_REQUIRED" },
      403,
    );
  }

  await next();
});