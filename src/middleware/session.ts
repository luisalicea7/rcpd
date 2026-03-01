import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import { v4 as uuidv4 } from "uuid";
import { redis } from "../config/redis.js";
import { config } from "../config/index.js";
import { trackSessionKey } from "../utils/session-keys.js";

export const sessionMiddleware = createMiddleware(async (c, next) => {
  let sessionId = getCookie(c, "rpd_session");

  if (!sessionId) {
    sessionId = uuidv4();
    setCookie(c, "rpd_session", sessionId, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: config.SESSION_TTL,
      secure: !config.isDev,
    });
    const sessionDataKey = `session:${sessionId}:data`;
    await redis.hset(sessionDataKey, {
      createdAt: String(Date.now()),
      lastActiveAt: String(Date.now()),
    });
    await redis.expire(sessionDataKey, config.SESSION_TTL);
    await trackSessionKey(sessionId, sessionDataKey);
  } else {
    // Refresh cookie + TTL and update last active timestamp on every request
    setCookie(c, "rpd_session", sessionId, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: config.SESSION_TTL,
      secure: !config.isDev,
    });

    const sessionDataKey = `session:${sessionId}:data`;
    await redis.hset(sessionDataKey, {
      lastActiveAt: String(Date.now()),
    });
    await redis.expire(sessionDataKey, config.SESSION_TTL);
    await trackSessionKey(sessionId, sessionDataKey);
  }

  c.set("sessionId", sessionId);
  await next();
});