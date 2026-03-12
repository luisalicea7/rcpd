import { config } from "../config/index.js";
import { redis } from "../config/redis.js";
import { getProductById } from "./product-service.js";
import type { Cart, CartItem } from "../types/cart.js";
import { trackSessionKey } from "../utils/session-keys.js";

function cartKey(sessionId: string): string {
  return `cart:${sessionId}`;
}

function createEmptyCart(sessionId: string): Cart {
  return {
    sessionId,
    items: [],
    totalItems: 0,
    subtotal: 0,
    updatedAt: Date.now(),
  };
}

function recalculate(cart: Cart): Cart {
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Number(
    cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
  );

  return {
    ...cart,
    totalItems,
    subtotal,
    updatedAt: Date.now(),
  };
}

function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.id === "string" &&
    typeof v.productId === "string" &&
    typeof v.name === "string" &&
    typeof v.category === "string" &&
    typeof v.price === "number" &&
    typeof v.quantity === "number" &&
    typeof v.addedAt === "number" &&
    typeof v.updatedAt === "number"
  );
}

function isValidCart(value: unknown): value is Cart {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.sessionId === "string" &&
    Array.isArray(v.items) &&
    v.items.every((item) => isValidCartItem(item))
  );
}

async function saveCart(sessionId: string, cart: Cart): Promise<Cart> {
  const key = cartKey(sessionId);
  const normalized = recalculate(cart);

  await redis.set(key, JSON.stringify(normalized), "EX", config.SESSION_TTL);
  await trackSessionKey(sessionId, key);

  return normalized;
}

export async function getCart(sessionId: string): Promise<Cart> {
  const key = cartKey(sessionId);
  const raw = await redis.get(key);

  if (!raw) {
    return createEmptyCart(sessionId);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isValidCart(parsed)) {
      return createEmptyCart(sessionId);
    }

    await redis.expire(key, config.SESSION_TTL);
    await trackSessionKey(sessionId, key);

    return recalculate(parsed);
  } catch {
    return createEmptyCart(sessionId);
  }
}

export async function addCartItem(
  sessionId: string,
  productId: string,
  quantity: number,
): Promise<Cart | null> {
  const product = getProductById(productId);
  if (!product) return null;

  const current = await getCart(sessionId);
  const existing = current.items.find((item) => item.id === product.id);

  let nextItems: CartItem[];
  if (existing) {
    nextItems = current.items.map((item) =>
      item.id === product.id
        ? {
            ...item,
            quantity: item.quantity + quantity,
            updatedAt: Date.now(),
          }
        : item,
    );
  } else {
    const now = Date.now();
    nextItems = [
      ...current.items,
      {
        id: product.id,
        productId: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        quantity,
        addedAt: now,
        updatedAt: now,
      },
    ];
  }

  return saveCart(sessionId, {
    ...current,
    items: nextItems,
  });
}

export async function updateCartItemQuantity(
  sessionId: string,
  itemId: string,
  quantity: number,
): Promise<Cart | null> {
  const current = await getCart(sessionId);
  const hasItem = current.items.some((item) => item.id === itemId);
  if (!hasItem) return null;

  const nextItems = current.items.map((item) =>
    item.id === itemId ? { ...item, quantity, updatedAt: Date.now() } : item,
  );

  return saveCart(sessionId, {
    ...current,
    items: nextItems,
  });
}

export async function removeCartItem(sessionId: string, itemId: string): Promise<Cart | null> {
  const current = await getCart(sessionId);
  const nextItems = current.items.filter((item) => item.id !== itemId);

  if (nextItems.length === current.items.length) {
    return null;
  }

  return saveCart(sessionId, {
    ...current,
    items: nextItems,
  });
}
