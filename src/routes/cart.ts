import { Hono } from "hono";
import {
  addCartItemHandler,
  getCartHandler,
  removeCartItemHandler,
  updateCartItemHandler,
} from "../controllers/cart-controller.js";
import { requireConsent } from "../middleware/consent.js";

export const cartRoutes = new Hono();

cartRoutes.use("*", requireConsent);

cartRoutes.get("/", getCartHandler);
cartRoutes.post("/items", addCartItemHandler);
cartRoutes.patch("/items/:id", updateCartItemHandler);
cartRoutes.delete("/items/:id", removeCartItemHandler);
