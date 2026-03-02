import { Hono } from "hono";
import { requireConsent } from "../middleware/consent.js";
import { productViewBodySchema } from "../schemas/events.js";
import { publishEvent } from "../services/event-producer.js";
import { getProductById } from "../services/product-service.js";
import { EventType, type ProductViewEvent } from "../types/events.js";

export const eventsRoutes = new Hono();

eventsRoutes.use("*", requireConsent);

eventsRoutes.post("/product-view", async (c) => {
  const sessionId = c.get("sessionId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid event payload", code: "INVALID_EVENT" }, 400);
  }

  const parsed = productViewBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid event payload",
        code: "INVALID_EVENT",
        details: parsed.error.issues,
      },
      400,
    );
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

  const streamId = await publishEvent(event);

  return c.json({ ok: true, streamId, eventType: event.type }, 201);
});
