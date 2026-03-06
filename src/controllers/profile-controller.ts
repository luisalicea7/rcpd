import type { Context } from "hono";
import { getProfile } from "../services/profile-service.js";
import { requireSessionId } from "../utils/session-context.js";

export async function getMyProfileHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  const profile = await getProfile(sessionId);
  return c.json(profile);
}
