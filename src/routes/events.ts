import { Hono } from "hono";
import {
  createAddToCartEventHandler,
  createProductViewEventHandler,
  createRemoveFromCartEventHandler,
  createSearchEventHandler,
} from "../controllers/events-controller.js";
import { requireConsent } from "../middleware/consent.js";

export const eventsRoutes = new Hono();

eventsRoutes.use("*", requireConsent);

eventsRoutes.post("/product-view", createProductViewEventHandler);
eventsRoutes.post("/search", createSearchEventHandler);
eventsRoutes.post("/add-to-cart", createAddToCartEventHandler);
eventsRoutes.post("/remove-from-cart", createRemoveFromCartEventHandler);
