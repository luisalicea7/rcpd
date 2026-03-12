import type { Context } from "hono";
import { logger } from "../utils/logger.js";
import {
  addCartItemBodySchema,
  updateCartItemBodySchema,
} from "../schemas/cart.js";
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../services/cart-service.js";
import { requireSessionId } from "../utils/session-context.js";

function redactSessionId(sessionId: string): string {
  if (sessionId.length <= 10) {
    return "****REDACTED****";
  }

  return `${sessionId.slice(0, 6)}...${sessionId.slice(-4)}`;
}

function respondRedisUnavailable(c: Context, sessionId: string, err: unknown): Response {
  logger.error(
    { err, path: c.req.path, sessionId: redactSessionId(sessionId) },
    "Redis unavailable during cart request",
  );

  return c.json({ error: "Service unavailable", code: "REDIS_UNAVAILABLE" }, 503);
}

function invalidPayload(c: Context): Response {
  return c.json({ error: "Invalid cart payload", code: "INVALID_CART_PAYLOAD" }, 400);
}

export async function getCartHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  try {
    const cart = await getCart(sessionId);
    return c.json(cart);
  } catch (err) {
    return respondRedisUnavailable(c, sessionId, err);
  }
}

export async function addCartItemHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return invalidPayload(c);
  }

  const parsed = addCartItemBodySchema.safeParse(body);
  if (!parsed.success) {
    return invalidPayload(c);
  }

  try {
    const cart = await addCartItem(sessionId, parsed.data.productId, parsed.data.quantity);
    if (!cart) {
      return c.json({ error: "Product not found", code: "PRODUCT_NOT_FOUND" }, 404);
    }

    return c.json(cart, 201);
  } catch (err) {
    return respondRedisUnavailable(c, sessionId, err);
  }
}

export async function updateCartItemHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return invalidPayload(c);
  }

  const parsed = updateCartItemBodySchema.safeParse(body);
  if (!parsed.success) {
    return invalidPayload(c);
  }

  try {
    const itemId = c.req.param("id");
    const cart = await updateCartItemQuantity(sessionId, itemId, parsed.data.quantity);
    if (!cart) {
      return c.json({ error: "Cart item not found", code: "CART_ITEM_NOT_FOUND" }, 404);
    }

    return c.json(cart);
  } catch (err) {
    return respondRedisUnavailable(c, sessionId, err);
  }
}

export async function removeCartItemHandler(c: Context): Promise<Response> {
  const sessionId = requireSessionId(c);
  if (sessionId instanceof Response) return sessionId;

  try {
    const itemId = c.req.param("id");
    const removed = await removeCartItem(sessionId, itemId);
    if (!removed) {
      return c.json({ error: "Cart item not found", code: "CART_ITEM_NOT_FOUND" }, 404);
    }

    const cart = await getCart(sessionId);
    return c.json(cart);
  } catch (err) {
    return respondRedisUnavailable(c, sessionId, err);
  }
}
