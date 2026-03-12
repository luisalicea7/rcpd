import type { Context } from "hono";
import { z } from "zod";
import {
  addToCartBodySchema,
  clickEventBodySchema,
  filterChangeEventBodySchema,
  idleEventBodySchema,
  pageViewBodySchema,
  productViewBodySchema,
  removeFromCartBodySchema,
  scrollEventBodySchema,
  searchEventBodySchema,
} from "../schemas/events.js";
import { publishEvent } from "../services/event-producer.js";
import { backstageManager } from "../services/backstage-manager.js";
import { getProductById } from "../services/product-service.js";
import {
  EventType,
  type AddToCartEvent,
  type AppEvent,
  type ClickEvent,
  type FilterChangeEvent,
  type IdleEvent,
  type PageViewEvent,
  type ProductViewEvent,
  type RemoveFromCartEvent,
  type ScrollEvent,
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

    backstageManager.emit("capture", {
      sessionId,
      eventId: streamId,
      traceId: streamId,
      payload: {
        eventType,
        source: c.req.path,
        page: "page" in event ? event.page : undefined,
        element: "element" in event ? event.element : undefined,
        filter: "filter" in event ? event.filter : undefined,
        depth: "depth" in event ? event.depth : undefined,
        productId: "productId" in event ? event.productId : undefined,
        category: "category" in event ? event.category : undefined,
        price: "price" in event ? event.price : undefined,
      },
    });

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

export async function createPageViewEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, pageViewBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const event: PageViewEvent = {
    type: EventType.PAGE_VIEW,
    sessionId,
    timestamp: Date.now(),
    page: data.page,
    referrer: data.referrer,
  };

  return publishOr503(c, sessionId, event.type, event);
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

export async function createIdleEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, idleEventBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const event: IdleEvent = {
    type: EventType.IDLE,
    sessionId,
    timestamp: Date.now(),
    idleDuration: data.idleDuration,
    page: data.page,
  };

  return publishOr503(c, sessionId, event.type, event);
}

export async function createClickEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, clickEventBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const event: ClickEvent = {
    type: EventType.CLICK,
    sessionId,
    timestamp: Date.now(),
    element: data.element,
    page: data.page,
  };

  return publishOr503(c, sessionId, event.type, event);
}

export async function createScrollEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, scrollEventBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const event: ScrollEvent = {
    type: EventType.SCROLL,
    sessionId,
    timestamp: Date.now(),
    depth: data.depth,
    page: data.page,
  };

  return publishOr503(c, sessionId, event.type, event);
}

export async function createFilterChangeEventHandler(c: Context): Promise<Response> {
  const parsedRequest = await parseEventRequest(c, filterChangeEventBodySchema);
  if (parsedRequest instanceof Response) return parsedRequest;

  const { sessionId, data } = parsedRequest;

  const event: FilterChangeEvent = {
    type: EventType.FILTER_CHANGE,
    sessionId,
    timestamp: Date.now(),
    filter: data.filter,
    value: data.value,
  };

  return publishOr503(c, sessionId, event.type, event);
}
