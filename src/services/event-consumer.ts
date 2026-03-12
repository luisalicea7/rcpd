import { config } from "../config/index.js";
import { createConsumerClient, redis, type RedisClient } from "../config/redis.js";
import type { AppEvent } from "../types/events.js";
import { logger } from "../utils/logger.js";
import { updateProfileFromEvent } from "./profile-service.js";
import { backstageManager } from "./backstage-manager.js";

const EVENTS_STREAM_KEY = "rpd:events";
const DEDUPE_KEY_PREFIX = "consumer:profile:processed";

function dedupeKey(sessionId: string): string {
  return `${DEDUPE_KEY_PREFIX}:${sessionId}`;
}

function isAppEvent(value: unknown): value is AppEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;

  if (typeof event.type !== "string") return false;
  if (typeof event.sessionId !== "string" || event.sessionId.length === 0) return false;
  if (typeof event.timestamp !== "number") return false;

  switch (event.type) {
    case "page_view":
      return (
        typeof event.page === "string" &&
        (event.referrer === undefined || typeof event.referrer === "string")
      );
    case "product_view":
      return (
        typeof event.productId === "string" &&
        typeof event.productName === "string" &&
        typeof event.category === "string" &&
        typeof event.price === "number" &&
        (event.viewDuration === undefined || typeof event.viewDuration === "number")
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
    case "idle":
      return typeof event.idleDuration === "number" && typeof event.page === "string";
    case "click":
      return typeof event.element === "string" && typeof event.page === "string";
    case "scroll":
      return typeof event.depth === "number" && typeof event.page === "string";
    case "filter_change":
      return typeof event.filter === "string" && typeof event.value === "string";
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

async function ensureConsumerGroup(client: RedisClient): Promise<void> {
  try {
    await client.xgroupCreate(EVENTS_STREAM_KEY, config.PROFILE_CONSUMER_GROUP, "0", true);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("BUSYGROUP")) {
      throw err;
    }
  }
}

async function isDuplicateEvent(event: AppEvent, eventId: string): Promise<boolean> {
  const key = dedupeKey(event.sessionId);
  const setResult = await redis.set(key, eventId, "NX", "EX", 60 * 60 * 24);

  if (setResult === "OK") {
    return false;
  }

  const currentMarker = await redis.get(key);
  if (currentMarker === eventId) {
    return true;
  }

  return true;
}

async function processEntry(client: RedisClient, id: string, fields: string[]): Promise<boolean> {
  const event = parseEventFromFields(fields);
  if (!event) {
    logger.warn({ id }, "Skipping malformed stream payload");
    await client.xack(EVENTS_STREAM_KEY, config.PROFILE_CONSUMER_GROUP, id);
    return false;
  }

  if (await isDuplicateEvent(event, id)) {
    await client.xack(EVENTS_STREAM_KEY, config.PROFILE_CONSUMER_GROUP, id);
    return false;
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

  await client.xack(EVENTS_STREAM_KEY, config.PROFILE_CONSUMER_GROUP, id);

  try {
    await client.xtrimMaxLen(EVENTS_STREAM_KEY, config.EVENTS_STREAM_MAXLEN, true);
  } catch (err) {
    logger.warn(
      { err, streamKey: EVENTS_STREAM_KEY, maxLen: config.EVENTS_STREAM_MAXLEN },
      "Failed to trim events stream post-ack",
    );
  }

  return true;
}

async function processReadResults(client: RedisClient, results: Record<string, Array<[string, string[]]>> | null): Promise<number> {
  if (!results || Object.keys(results).length === 0) return 0;

  let processed = 0;
  for (const entries of Object.values(results)) {
    for (const [id, fields] of entries) {
      try {
        const handled = await processEntry(client, id, fields as string[]);
        if (handled) processed += 1;
      } catch (err) {
        logger.error({ err, id }, "Failed processing stream entry; leaving pending for retry");
      }
    }
  }

  return processed;
}

async function reclaimStalePending(client: RedisClient): Promise<number> {
  try {
    const [nextStartId, entries] = await client.xautoclaim(
      EVENTS_STREAM_KEY,
      config.PROFILE_CONSUMER_GROUP,
      config.PROFILE_CONSUMER_NAME,
      config.PROFILE_CONSUMER_RECLAIM_IDLE_MS,
      "0-0",
      config.PROFILE_CONSUMER_RECLAIM_BATCH_SIZE,
    );

    if (entries.length === 0) return 0;

    const wrapped: Record<string, Array<[string, string[]]>> = {
      [EVENTS_STREAM_KEY]: entries as Array<[string, string[]]>,
    };

    const reclaimedProcessed = await processReadResults(client, wrapped);
    logger.info(
      { reclaimedProcessed, nextStartId, idleMs: config.PROFILE_CONSUMER_RECLAIM_IDLE_MS },
      "Reclaimed stale pending events",
    );

    return reclaimedProcessed;
  } catch (err) {
    logger.error({ err }, "Failed to reclaim stale pending events");
    return 0;
  }
}

export async function consumeProfileEventsOnce(batchSize = config.PROFILE_CONSUMER_BATCH_SIZE): Promise<number> {
  const client = await createConsumerClient();

  try {
    await ensureConsumerGroup(client);

    await reclaimStalePending(client);

    const results = await client.xreadgroup(
      config.PROFILE_CONSUMER_GROUP,
      config.PROFILE_CONSUMER_NAME,
      batchSize,
      1,
      EVENTS_STREAM_KEY,
      ">",
    );

    return processReadResults(client, results as Record<string, Array<[string, string[]]>> | null);
  } finally {
    client.close();
  }
}

export async function consumeProfileEventsLoop(intervalMs = 2000): Promise<void> {
  const client = await createConsumerClient();
  await ensureConsumerGroup(client);

  while (true) {
    try {
      await reclaimStalePending(client);

      const results = await client.xreadgroup(
        config.PROFILE_CONSUMER_GROUP,
        config.PROFILE_CONSUMER_NAME,
        config.PROFILE_CONSUMER_BATCH_SIZE,
        config.PROFILE_CONSUMER_BLOCK_MS,
        EVENTS_STREAM_KEY,
        ">",
      );

      await processReadResults(client, results as Record<string, Array<[string, string[]]>> | null);
    } catch (err) {
      logger.error({ err, intervalMs }, "Profile consumer iteration failed");
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
