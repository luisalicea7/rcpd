import type { Context } from "hono";

export function requireSessionId(c: Context): string | Response {
  const sessionId = c.get("sessionId");

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return c.json({ error: "Unauthorized", code: "SESSION_REQUIRED" }, 401);
  }

  return sessionId;
}
