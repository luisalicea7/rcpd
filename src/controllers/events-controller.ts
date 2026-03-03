import type { Context } from "hono";
import { z } from "zod";
import {
  addToCartBodySchema,
  productViewBodySchema,
  removeFromCartBodySchema,
  searchEventBodySchema,
} from "../schemas/events.js";
import { publishEvent } from "../services/event-producer.js";
import { getProductById } from "../services/product-service.js";
import {
  EventType,
  type AddToCartEvent,
  type AppEvent,
  type ProductViewEvent,
  type RemoveFromCartEvent,
  type SearchEvent,
} from "../types/events.js";
import { logger } from "../utils/logger.js";
import { requireSessionId } from "../utils/session-context.js";

function redactSessionId(sessionId: string): string {
  if (sessionId.length <= 10) {
    return "****REDACTED****";
  }

  return `${sessionId.slice(0, 6)}...${sessionId.slice(-4)}`;
}

function invalidEventResponse(c: Context): Response {
  return c.json(
    {
      error: "Invalid event payload",
      code: "INVALID_EVENT",
    },
    400,
  );
}

async function parseEventRequest<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<{ sessionId: string; data: z.infer<T> } | Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return invalidEventResponse(c);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    logger.warn(
      {
        path: c.req.path,
        sessionId: redactSessionId(sessionId),
        issues: parsed.error.issues,
      },
      "Invalid event payload validation",
    );
    return invalidEventResponse(c);
  }

  return { sessionId, data: parsed.data };
}

async function publishOr503(
  c: Context,
  sessionId: string,
  eventType: EventType,
  event: AppEvent,
): Promise<Response> {
  try {
    const streamId = await publishEvent(event);
    return c.json({ ok: true, streamId, eventType }, 201);
  } catch (err) {
    logger.error(
      {
        err,
        sessionId: redactSessionId(sessionId),
        path: c.req.path,
        eventType,
      },
      "Redis unavailable during event publish",
    );

    return c.json({ ok: false, error: "Service unavailable", code: "REDIS_UNAVAILABLE" }, 503);
  }
}

export async function createProductViewEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, productViewBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const product = getProductById(data.productId);
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
    viewDuration: data.viewDuration,
  };

  return publishOr503(c, sessionId, event.type, event);
}

export async function createSearchEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, searchEventBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const event: SearchEvent = {
    type: EventType.SEARCH,
    sessionId,
    timestamp: Date.now(),
    query: data.query,
    resultsCount: data.resultsCount,
  };

  return publishOr503(c, sessionId, event.type, event);
}

export async function createAddToCartEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, addToCartBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const product = getProductById(data.productId);
  if (!product) {
    return c.json({ error: "Product not found", code: "PRODUCT_NOT_FOUND" }, 404);
  }

  const event: AddToCartEvent = {
    type: EventType.ADD_TO_CART,
    sessionId,
    timestamp: Date.now(),
    productId: product.id,
    productName: product.name,
    category: product.category,
    price: product.price,
    quantity: data.quantity,
  };

  return publishOr503(c, sessionId, event.type, event);
}

export async function createRemoveFromCartEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, removeFromCartBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const event: RemoveFromCartEvent = {
    type: EventType.REMOVE_FROM_CART,
    sessionId,
    timestamp: Date.now(),
    productId: data.productId,
    quantity: data.quantity,
  };

  return publishOr503(c, sessionId, event.type, event);
}
