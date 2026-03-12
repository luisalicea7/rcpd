import type { Context } from "hono";
import {
  getPersonalization,
  getPersonalizationHistory,
} from "../services/personalization-service.js";
import {
  isRedisUnavailableError,
  respondRedisUnavailable,
} from "../utils/redis-availability.js";
import { requireSessionId } from "../utils/session-context.js";

function resolveTraceId(c: Context): string | undefined {
  return c.req.header("x-trace-id") ?? c.req.query("traceId") ?? undefined;
}

export async function getMyPersonalizationHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  const result = await getPersonalization(sessionId, resolveTraceId(c));
  return c.json(result);
}

export async function getPersonalizationActionsCompatHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  try {
    const result = await getPersonalization(sessionId, resolveTraceId(c));
    return c.json({
      sessionId,
      generatedAt: result.generatedAt,
      actions: result.actions,
    });
  } catch (err) {
    if (isRedisUnavailableError(err)) {
      return respondRedisUnavailable(c, err, "Redis unavailable during personalization actions", {
        sessionId,
      });
    }

    throw err;
  }
}

export async function getPersonalizationHistoryCompatHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  try {
    const history = await getPersonalizationHistory(sessionId);
    return c.json({
      sessionId,
      count: history.length,
      history,
    });
  } catch (err) {
    if (isRedisUnavailableError(err)) {
      return respondRedisUnavailable(c, err, "Redis unavailable during personalization history", {
        sessionId,
      });
    }

    throw err;
  }
}
