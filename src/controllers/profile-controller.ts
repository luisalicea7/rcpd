import type { Context } from "hono";
import { getProfile } from "../services/profile-service.js";
import { requireSessionId } from "../utils/session-context.js";

function toCompatProfileResponse(profile: Awaited<ReturnType<typeof getProfile>>): {
  sessionId: string;
  profile: Awaited<ReturnType<typeof getProfile>>;
} {
  return {
    sessionId: profile.sessionId,
    profile,
  };
}

export async function getMyProfileHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  const profile = await getProfile(sessionId);
  return c.json(profile);
}

export async function getProfileCompatHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  const profile = await getProfile(sessionId);
  return c.json(toCompatProfileResponse(profile));
}
