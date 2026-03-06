import { consumeProfileEventsLoop, consumeProfileEventsOnce } from "../services/event-consumer.js";
import { logger } from "../utils/logger.js";

type ConsumerMode = "once" | "loop";

function isConsumerMode(mode: string): mode is ConsumerMode {
  return mode === "once" || mode === "loop";
}

async function main(): Promise<void> {
  const modeArg = process.argv[2] ?? "once";

  if (!isConsumerMode(modeArg)) {
    logger.error({ mode: modeArg }, "Invalid profile consumer mode. Use 'once' or 'loop'.");
    process.exit(1);
  }

  try {
    if (modeArg === "loop") {
      logger.info({ mode: modeArg }, "Starting profile consumer loop");
      await consumeProfileEventsLoop();
      return;
    }

    const count = await consumeProfileEventsOnce();
    logger.info({ processed: count, mode: modeArg }, "Profile consumer processed events");
  } catch (err) {
    logger.error({ err, mode: modeArg }, "Profile consumer failed");
    process.exit(1);
  }
}

void main();
