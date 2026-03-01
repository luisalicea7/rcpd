import { Redis } from "ioredis";
import { config } from "./index.js";

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 1,
  lazyConnect: false,
});

redis.on("connect", () => console.log("[redis] connected"));
redis.on("error", (err) => console.error("[redis] error", err));

// Dedicated client for the blocking XREADGROUP call in the event consumer.
// Keeps the main client free for regular operations during blocking reads.
export function createConsumerClient(): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null, // keep retrying in consumer
    lazyConnect: false,
  });
}