import { config } from "../config/index.js";
import { redis } from "../config/redis.js";
import type { AppEvent } from "../types/events.js";
import { logger } from "../utils/logger.js";

const EVENTS_STREAM_KEY = "rpd:events";

export async function publishEvent(event: AppEvent): Promise<string> {
  const streamId = await redis.xadd(
    EVENTS_STREAM_KEY,
    "*",
    "type",
    event.type,
    "sessionId",
    event.sessionId,
    "timestamp",
    String(event.timestamp),
    "payload",
    JSON.stringify(event),
  );

  if (!streamId) {
    throw new Error("Failed to publish event to Redis stream");
  }

  try {
    await redis.xtrimMaxLen(EVENTS_STREAM_KEY, config.EVENTS_STREAM_MAXLEN, true);
  } catch (err) {
    logger.warn(
      { err, streamKey: EVENTS_STREAM_KEY, maxLen: config.EVENTS_STREAM_MAXLEN },
      "Failed to trim events stream",
    );
  }

  return streamId;
}

export function getEventsStreamKey(): string {
  return EVENTS_STREAM_KEY;
}
