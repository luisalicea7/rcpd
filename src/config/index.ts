import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string(),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  SESSION_TTL: z.coerce.number().int().positive().default(1800),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  EVENTS_STREAM_MAXLEN: z.coerce.number().int().positive().default(10000),
  PROFILE_CONSUMER_GROUP: z.string().default("profile-builders"),
  PROFILE_CONSUMER_NAME: z.string().default("profile-consumer-1"),
  PROFILE_CONSUMER_BLOCK_MS: z.coerce.number().int().positive().default(5000),
  PROFILE_CONSUMER_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  PROFILE_CONSUMER_RECLAIM_IDLE_MS: z.coerce.number().int().positive().default(60000),
  PROFILE_CONSUMER_RECLAIM_BATCH_SIZE: z.coerce.number().int().positive().default(50),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.issues);
  process.exit(1);
}

export const config = {
  PORT: parsed.data.PORT,
  REDIS_URL: parsed.data.REDIS_URL,
  FRONTEND_URL: parsed.data.FRONTEND_URL,
  SESSION_TTL: parsed.data.SESSION_TTL,
  NODE_ENV: parsed.data.NODE_ENV,
  EVENTS_STREAM_MAXLEN: parsed.data.EVENTS_STREAM_MAXLEN,
  PROFILE_CONSUMER_GROUP: parsed.data.PROFILE_CONSUMER_GROUP,
  PROFILE_CONSUMER_NAME: parsed.data.PROFILE_CONSUMER_NAME,
  PROFILE_CONSUMER_BLOCK_MS: parsed.data.PROFILE_CONSUMER_BLOCK_MS,
  PROFILE_CONSUMER_BATCH_SIZE: parsed.data.PROFILE_CONSUMER_BATCH_SIZE,
  PROFILE_CONSUMER_RECLAIM_IDLE_MS: parsed.data.PROFILE_CONSUMER_RECLAIM_IDLE_MS,
  PROFILE_CONSUMER_RECLAIM_BATCH_SIZE: parsed.data.PROFILE_CONSUMER_RECLAIM_BATCH_SIZE,
  isDev: parsed.data.NODE_ENV === "development",
};
