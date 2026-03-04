import { redis } from "../config/redis.js";
import type { AppEvent } from "../types/events.js";
import { updateProfileFromEvent } from "./profile-service.js";

const EVENTS_STREAM_KEY = "rpd:events";
const CONSUMER_CURSOR_KEY = "consumer:profile:lastId";

function parseEventFromFields(fields: string[]): AppEvent | null {
  const payloadIndex = fields.findIndex((x) => x === "payload");
  if (payloadIndex === -1 || !fields[payloadIndex + 1]) return null;

  try {
    return JSON.parse(fields[payloadIndex + 1]!) as AppEvent;
  } catch {
    return null;
  }
}

export async function consumeProfileEventsOnce(batchSize = 50): Promise<number> {
  const lastId = (await redis.get(CONSUMER_CURSOR_KEY)) ?? "0-0";

  const results = await redis.xread(
    "COUNT",
    batchSize,
    "STREAMS",
    EVENTS_STREAM_KEY,
    lastId,
  );

  if (!results || results.length === 0) return 0;

  let processed = 0;
  let newestId = lastId;

  for (const [, entries] of results) {
    for (const [id, fields] of entries) {
      newestId = id;
      const event = parseEventFromFields(fields as string[]);
      if (!event) continue;

      await updateProfileFromEvent(event);
      processed += 1;
    }
  }

  await redis.set(CONSUMER_CURSOR_KEY, newestId);
  return processed;
}

export async function consumeProfileEventsLoop(intervalMs = 2000): Promise<void> {
  while (true) {
    await consumeProfileEventsOnce();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
