import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000"),
  REDIS_URL: z.string(),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  SESSION_TTL: z.string().default("1800"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
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
  isDev: parsed.data.NODE_ENV === "development",
};