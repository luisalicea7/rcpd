import { Hono } from "hono";
import { ZodError } from "zod";
import { requireConsent } from "../middleware/consent.js";
import { productViewBodySchema } from "../schemas/events.js";
import { publishEvent } from "../services/event-producer.js";
import { getProductById } from "../services/product-service.js";
import { EventType, type ProductViewEvent } from "../types/events.js";
import { requireSessionId } from "../utils/session-context.js";

export const eventsRoutes = new Hono();

eventsRoutes.use("*", requireConsent);

eventsRoutes.post("/product-view", async (c) => {
  try {
    const session = requireSessionId(c);
    if (session instanceof Response) return session;

    const body = await c.req.json();
    const parsed = productViewBodySchema.parse(body);
    const product = getProductById(parsed.productId);

    if (!product) {
      return c.json({ error: "Product not found", code: "PRODUCT_NOT_FOUND" }, 404);
    }

    const event: ProductViewEvent = {
      type: EventType.PRODUCT_VIEW,
      sessionId: session,
      timestamp: Date.now(),
      productId: product.id,
      productName: product.name,
      category: product.category,
      price: product.price,
      viewDuration: parsed.viewDuration,
    };

    const streamId = await publishEvent(event);

    return c.json({ ok: true, streamId, eventType: event.type }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json(
        { error: "Invalid event payload", code: "INVALID_EVENT", details: err.issues },
        400,
      );
    }

    throw err;
  }
});
