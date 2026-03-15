import type { Context } from "hono";
import { redis } from "../config/redis.js";
import { config } from "../config/index.js";

export async function sessionInfoHandler(c: Context): Promise<Response> {
  const sessionId = c.get("sessionId") as string;
  const key = `session:${sessionId}:data`;

  const [rawFields, ttlSeconds] = await Promise.all([
    redis.eval(
      "local r = redis.call('HGETALL', KEYS[1]); return r",
      [key],
      [],
    ) as Promise<string[]>,
    redis.eval(
      "return redis.call('TTL', KEYS[1])",
      [key],
      [],
    ) as Promise<number>,
  ]);

  // HGETALL returns flat [field, value, field, value, …] array
  const sessionData: Record<string, string> = {};
  if (Array.isArray(rawFields)) {
    for (let i = 0; i < rawFields.length - 1; i += 2) {
      sessionData[rawFields[i]] = rawFields[i + 1];
    }
  }

  const createdAt = sessionData.createdAt ? Number(sessionData.createdAt) : null;
  const lastActiveAt = sessionData.lastActiveAt ? Number(sessionData.lastActiveAt) : null;

  return c.json({
    cookie: {
      name: "rpd_session",
      value: `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`,
      properties: {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        secure: !config.isDev,
        maxAge: config.SESSION_TTL,
      },
    },
    session: {
      id: sessionId,
      idShort: `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`,
      createdAt: createdAt ? new Date(createdAt).toISOString() : null,
      lastActiveAt: lastActiveAt ? new Date(lastActiveAt).toISOString() : null,
      ttlSeconds: ttlSeconds > 0 ? ttlSeconds : 0,
      ttlTotal: config.SESSION_TTL,
    },
  });
}