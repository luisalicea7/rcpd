import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config/index.js";
import { sessionMiddleware } from "./middleware/session.js";
import { consentRoutes } from "./routes/consent.js";
import { logger } from "./utils/logger.js";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }),
);

app.use("*", sessionMiddleware);

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/api/consent", consentRoutes);

app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, "Unhandled application error");
  return c.json({ error: "Internal server error" }, 500);
});
