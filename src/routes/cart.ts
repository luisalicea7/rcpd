import { Hono } from "hono";
import {
  addCartItemHandler,
  getCartHandler,
  removeCartItemHandler,
  updateCartItemHandler,
} from "../controllers/cart-controller.js";
export const cartRoutes = new Hono();

cartRoutes.get("/", getCartHandler);
cartRoutes.post("/items", addCartItemHandler);
cartRoutes.patch("/items/:id", updateCartItemHandler);
cartRoutes.delete("/items/:id", removeCartItemHandler);
