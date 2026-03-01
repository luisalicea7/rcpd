import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { redis } from "../config/redis.js";
import { config } from "../config/index.js";
import { keyIndexKey, trackSessionKey } from "../utils/session-keys.js";

const consentRoutes = new Hono();

consentRoutes.get("/status", async (c) => {
  const sessionId = c.get("sessionId");
  const consent = await redis.get(`session:${sessionId}:consent`);

  return c.json({
    sessionId,
    consent: consent === "granted" ? "granted" : "pending",
  });
});

consentRoutes.post("/grant", async (c) => {
  const sessionId = c.get("sessionId");
  const consentKey = `session:${sessionId}:consent`;

  await redis.set(consentKey, "granted", "EX", config.SESSION_TTL);
  await trackSessionKey(sessionId, consentKey);

  return c.json({
    ok: true,
    consent: "granted",
    ttlSeconds: config.SESSION_TTL,
  });
});

consentRoutes.post("/revoke", async (c) => {
  const sessionId = c.get("sessionId");
  const index = keyIndexKey(sessionId);

  const indexedKeys = await redis.smembers(index);
  const baselineKeys = [
    `session:${sessionId}:consent`,
    `session:${sessionId}:data`,
    index,
    `profile:${sessionId}`,
    `cart:${sessionId}`,
    `actions:${sessionId}`,
  ];

  const keysToDelete = Array.from(new Set([...indexedKeys, ...baselineKeys]));
  if (keysToDelete.length > 0) {
    await redis.unlink(...keysToDelete);
  }

  deleteCookie(c, "rpd_session", {
    path: "/",
  });

  return c.json({
    ok: true,
    revoked: true,
    deletedKeys: keysToDelete.length,
  });
});

export { consentRoutes, trackSessionKey, keyIndexKey };
