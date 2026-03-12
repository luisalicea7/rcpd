import { config } from "../config/index.js";
import { redis } from "../config/redis.js";
import { getProductById } from "./product-service.js";
import type { Cart, CartItem } from "../types/cart.js";
import { trackSessionKey } from "../utils/session-keys.js";
import { logger } from "../utils/logger.js";

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

function recalculate(cart: Cart, preserveUpdatedAt = false): Cart {
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Number(
    cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
  );

  return {
    ...cart,
    totalItems,
    subtotal,
    updatedAt: preserveUpdatedAt ? cart.updatedAt : Date.now(),
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

  try {
    await trackSessionKey(sessionId, key);
  } catch (err) {
    logger.warn({ err, sessionId, key }, "Failed to track session key for cart (best-effort)");
  }

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

    return recalculate(parsed, true);
  } catch {
    return createEmptyCart(sessionId);
  }
}

async function addCartItemAtomic(
  sessionId: string,
  product: { id: string; name: string; category: string; price: number },
  quantity: number,
): Promise<Cart> {
  const key = cartKey(sessionId);

  const script = `
local key = KEYS[1]
local sessionId = ARGV[1]
local ttl = tonumber(ARGV[2])
local productId = ARGV[3]
local productName = ARGV[4]
local category = ARGV[5]
local price = tonumber(ARGV[6])
local quantity = tonumber(ARGV[7])
local now = tonumber(ARGV[8])

local cart = {
  sessionId = sessionId,
  items = {},
  totalItems = 0,
  subtotal = 0,
  updatedAt = now,
}

local raw = redis.call("GET", key)
if raw then
  local ok, parsed = pcall(cjson.decode, raw)
  if ok and type(parsed) == "table" and type(parsed.items) == "table" then
    cart = parsed
  end
end

local found = false
for i = 1, #cart.items do
  local item = cart.items[i]
  if item.id == productId then
    item.quantity = tonumber(item.quantity or 0) + quantity
    item.updatedAt = now
    found = true
    break
  end
end

if not found then
  cart.items[#cart.items + 1] = {
    id = productId,
    productId = productId,
    name = productName,
    category = category,
    price = price,
    quantity = quantity,
    addedAt = now,
    updatedAt = now,
  }
end

local totalItems = 0
local subtotal = 0
for i = 1, #cart.items do
  local item = cart.items[i]
  local itemQty = tonumber(item.quantity or 0)
  local itemPrice = tonumber(item.price or 0)
  totalItems = totalItems + itemQty
  subtotal = subtotal + (itemPrice * itemQty)
end

cart.totalItems = totalItems
cart.subtotal = math.floor((subtotal + 0.0000001) * 100) / 100
cart.updatedAt = now

local encoded = cjson.encode(cart)
redis.call("SET", key, encoded, "EX", ttl)
return encoded
`;

  const result = await redis.eval(script, [key], [
    sessionId,
    String(config.SESSION_TTL),
    product.id,
    product.name,
    product.category,
    String(product.price),
    String(quantity),
    String(Date.now()),
  ]);

  if (typeof result !== "string") {
    throw new Error("Unexpected Redis response while adding cart item atomically");
  }

  const parsed: unknown = JSON.parse(result);
  if (!isValidCart(parsed)) {
    throw new Error("Invalid cart payload from atomic add operation");
  }

  try {
    await trackSessionKey(sessionId, key);
  } catch (err) {
    logger.warn({ err, sessionId, key }, "Failed to track session key for cart (best-effort)");
  }

  return parsed;
}

export async function addCartItem(
  sessionId: string,
  productId: string,
  quantity: number,
): Promise<Cart | null> {
  const product = getProductById(productId);
  if (!product) return null;

  return addCartItemAtomic(sessionId, product, quantity);
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
