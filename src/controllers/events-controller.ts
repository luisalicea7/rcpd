import type { Context } from "hono";
import { productViewBodySchema } from "../schemas/events.js";
import { publishEvent } from "../services/event-producer.js";
import { getProductById } from "../services/product-service.js";
import { EventType, type ProductViewEvent } from "../types/events.js";
import { logger } from "../utils/logger.js";
import { requireSessionId } from "../utils/session-context.js";

function invalidEventResponse(c: Context, details?: unknown): Response {
  return c.json(
    {
      error: "Invalid event payload",
      code: "INVALID_EVENT",
      ...(details ? { details } : {}),
    },
    400,
  );
}

export async function createProductViewEventHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return invalidEventResponse(c);
  }

  const parsed = productViewBodySchema.safeParse(body);
  if (!parsed.success) {
    return invalidEventResponse(c, parsed.error.issues);
  }

  const product = getProductById(parsed.data.productId);
  if (!product) {
    return c.json({ error: "Product not found", code: "PRODUCT_NOT_FOUND" }, 404);
  }

  const event: ProductViewEvent = {
    type: EventType.PRODUCT_VIEW,
    sessionId,
    timestamp: Date.now(),
    productId: product.id,
    productName: product.name,
    category: product.category,
    price: product.price,
    viewDuration: parsed.data.viewDuration,
  };

  try {
    const streamId = await publishEvent(event);
    return c.json({ ok: true, streamId, eventType: event.type }, 201);
  } catch (err) {
    logger.error(
      { err, sessionId, path: c.req.path, eventType: event.type },
      "Redis unavailable during event publish",
    );

    return c.json({ ok: false, error: "Service unavailable", code: "REDIS_UNAVAILABLE" }, 503);
  }
}
