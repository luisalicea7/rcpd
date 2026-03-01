import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import { v4 as uuidv4 } from "uuid";
import { redis } from "../config/redis.js";
import { config } from "../config/index.js";

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
    await redis.hset(`session:${sessionId}:data`, {
      createdAt: String(Date.now()),
      lastActiveAt: String(Date.now()),
    });
    await redis.expire(`session:${sessionId}:data`, config.SESSION_TTL);
  } else {
    // Refresh TTL and update last active timestamp on every request
    await redis.hset(`session:${sessionId}:data`, {
      lastActiveAt: String(Date.now()),
    });
    await redis.expire(`session:${sessionId}:data`, config.SESSION_TTL);
  }

  c.set("sessionId", sessionId);
  await next();
});