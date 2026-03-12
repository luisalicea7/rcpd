import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { app, mountBackstageRoutes } from "./app.js";
import { config } from "./config/index.js";
import { redis } from "./config/redis.js";
import { logger } from "./utils/logger.js";

async function bootstrap(): Promise<void> {
  try {
    await redis.ping();
    logger.info("Redis connection verified");

    const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
    mountBackstageRoutes(upgradeWebSocket);

    const server = serve({
      fetch: app.fetch,
      port: config.PORT,
    });

    injectWebSocket(server);

    logger.info({ port: config.PORT }, "RPD backend started");
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap server");
    process.exit(1);
  }
}

void bootstrap();
