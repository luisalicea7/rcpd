import { redis } from "../config/redis.js";
import type { AppEvent } from "../types/events.js";
import { logger } from "../utils/logger.js";
import { updateProfileFromEvent } from "./profile-service.js";
import { backstageManager } from "./backstage-manager.js";

const EVENTS_STREAM_KEY = "rpd:events";
const CONSUMER_CURSOR_KEY = "consumer:profile:lastId";

function isAppEvent(value: unknown): value is AppEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;

  if (typeof event.type !== "string") return false;
  if (typeof event.sessionId !== "string" || event.sessionId.length === 0) return false;
  if (typeof event.timestamp !== "number") return false;

  switch (event.type) {
    case "product_view":
      return (
        typeof event.productId === "string" &&
        typeof event.productName === "string" &&
        typeof event.category === "string" &&
        typeof event.price === "number"
      );
    case "search":
      return typeof event.query === "string" && typeof event.resultsCount === "number";
    case "add_to_cart":
      return (
        typeof event.productId === "string" &&
        typeof event.productName === "string" &&
        typeof event.category === "string" &&
        typeof event.price === "number" &&
        typeof event.quantity === "number"
      );
    case "remove_from_cart":
      return typeof event.productId === "string" && typeof event.quantity === "number";
    default:
      return false;
  }
}

function parseEventFromFields(fields: string[]): AppEvent | null {
  const payloadIndex = fields.findIndex((x) => x === "payload");
  if (payloadIndex === -1 || !fields[payloadIndex + 1]) return null;

  try {
    const parsed: unknown = JSON.parse(fields[payloadIndex + 1]!);
    if (!isAppEvent(parsed)) return null;
    return parsed;
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

  if (!results || Object.keys(results).length === 0) return 0;

  let processed = 0;

  for (const entries of Object.values(results)) {
    for (const [id, fields] of entries) {
      const event = parseEventFromFields(fields as string[]);
      if (!event) {
        continue;
      }

      const updatedProfile = await updateProfileFromEvent(event);

      const topInterest = updatedProfile.interests.slice().sort((a, b) => b.score - a.score)[0];

      backstageManager.emit("learn", {
        sessionId: event.sessionId,
        eventId: id,
        traceId: id,
        payload: {
          profileDelta: {
            topCategory: topInterest?.category,
            newInterestScore: topInterest?.score,
            avgViewedPrice: updatedProfile.priceStats?.avg,
            abandonmentRisk: updatedProfile.abandonmentRisk.score,
          },
        },
      });

      processed += 1;
      await redis.set(CONSUMER_CURSOR_KEY, id);
    }
  }

  return processed;
}

export async function consumeProfileEventsLoop(intervalMs = 2000): Promise<void> {
  while (true) {
    try {
      await consumeProfileEventsOnce();
    } catch (err) {
      logger.error({ err, intervalMs }, "Profile consumer iteration failed");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
