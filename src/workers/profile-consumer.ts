import { consumeProfileEventsLoop, consumeProfileEventsOnce } from "../services/event-consumer.js";
import { logger } from "../utils/logger.js";

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "once";

  if (mode === "loop") {
    logger.info("Starting profile consumer loop");
    await consumeProfileEventsLoop();
    return;
  }

  const count = await consumeProfileEventsOnce();
  logger.info({ processed: count }, "Profile consumer processed events");
}

void main();
