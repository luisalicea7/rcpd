import type { Context } from "hono";
import { deleteCookie } from "hono/cookie";
import { redis } from "../config/redis.js";
import { config } from "../config/index.js";
import { requireSessionId } from "../utils/session-context.js";
import { keyIndexKey, trackSessionKey } from "../utils/session-keys.js";

export async function getConsentStatus(c: Context): Promise<Response> {
  const session = requireSessionId(c);
  if (session instanceof Response) return session;

  const consent = await redis.get(`session:${session}:consent`);

  return c.json({
    consent: consent === "granted" ? "granted" : "pending",
  });
}

export async function grantConsent(c: Context): Promise<Response> {
  const session = requireSessionId(c);
  if (session instanceof Response) return session;

  const consentKey = `session:${session}:consent`;
  await redis.set(consentKey, "granted", "EX", config.SESSION_TTL);
  await trackSessionKey(session, consentKey);

  return c.json({
    ok: true,
    consent: "granted",
    ttlSeconds: config.SESSION_TTL,
  });
}

export async function revokeConsent(c: Context): Promise<Response> {
  const session = requireSessionId(c);
  if (session instanceof Response) return session;

  const index = keyIndexKey(session);
  const indexedKeys = await redis.smembers(index);
  const baselineKeys = [
    `session:${session}:consent`,
    `session:${session}:data`,
    index,
    `profile:${session}`,
    `cart:${session}`,
    `actions:${session}`,
  ];

  const keysToDelete = Array.from(new Set([...indexedKeys, ...baselineKeys]));
  if (keysToDelete.length > 0) {
    await redis.unlink(...keysToDelete);
  }

  deleteCookie(c, "rpd_session", { path: "/" });

  return c.json({
    ok: true,
    revoked: true,
    deletedKeys: keysToDelete.length,
  });
}
