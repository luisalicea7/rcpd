import type { Context } from "hono";
import { getPersonalization } from "../services/personalization-service.js";
import { requireSessionId } from "../utils/session-context.js";

export async function getMyPersonalizationHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  const result = await getPersonalization(sessionId);
  return c.json(result);
}
