import { redis } from "../config/redis.js";
import type { AppEvent } from "../types/events.js";

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

  return streamId;
}

export function getEventsStreamKey(): string {
  return EVENTS_STREAM_KEY;
}
