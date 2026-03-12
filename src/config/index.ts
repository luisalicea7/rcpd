import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000"),
  REDIS_URL: z.string(),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  SESSION_TTL: z.string().default("1800"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  EVENTS_STREAM_MAXLEN: z.string().default("10000"),
  PROFILE_CONSUMER_GROUP: z.string().default("profile-builders"),
  PROFILE_CONSUMER_NAME: z.string().default("profile-consumer-1"),
  PROFILE_CONSUMER_BLOCK_MS: z.string().default("5000"),
  PROFILE_CONSUMER_BATCH_SIZE: z.string().default("50"),
  PROFILE_CONSUMER_RECLAIM_IDLE_MS: z.string().default("60000"),
  PROFILE_CONSUMER_RECLAIM_BATCH_SIZE: z.string().default("50"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.issues);
  process.exit(1);
}

export const config = {
  PORT: parseInt(parsed.data.PORT, 10),
  REDIS_URL: parsed.data.REDIS_URL,
  FRONTEND_URL: parsed.data.FRONTEND_URL,
  SESSION_TTL: parseInt(parsed.data.SESSION_TTL, 10),
  NODE_ENV: parsed.data.NODE_ENV,
  EVENTS_STREAM_MAXLEN: parseInt(parsed.data.EVENTS_STREAM_MAXLEN, 10),
  PROFILE_CONSUMER_GROUP: parsed.data.PROFILE_CONSUMER_GROUP,
  PROFILE_CONSUMER_NAME: parsed.data.PROFILE_CONSUMER_NAME,
  PROFILE_CONSUMER_BLOCK_MS: parseInt(parsed.data.PROFILE_CONSUMER_BLOCK_MS, 10),
  PROFILE_CONSUMER_BATCH_SIZE: parseInt(parsed.data.PROFILE_CONSUMER_BATCH_SIZE, 10),
  PROFILE_CONSUMER_RECLAIM_IDLE_MS: parseInt(parsed.data.PROFILE_CONSUMER_RECLAIM_IDLE_MS, 10),
  PROFILE_CONSUMER_RECLAIM_BATCH_SIZE: parseInt(parsed.data.PROFILE_CONSUMER_RECLAIM_BATCH_SIZE, 10),
  isDev: parsed.data.NODE_ENV === "development",
};
