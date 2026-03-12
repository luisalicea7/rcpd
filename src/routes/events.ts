import { Hono } from "hono";
import {
  createAddToCartEventHandler,
  createClickEventHandler,
  createFilterChangeEventHandler,
  createIdleEventHandler,
  createPageViewEventHandler,
  createProductViewEventHandler,
  createRemoveFromCartEventHandler,
  createScrollEventHandler,
  createSearchEventHandler,
} from "../controllers/events-controller.js";
import { requireConsent } from "../middleware/consent.js";

export const eventsRoutes = new Hono();

eventsRoutes.use("*", requireConsent);

eventsRoutes.post("/page-view", createPageViewEventHandler);
eventsRoutes.post("/product-view", createProductViewEventHandler);
eventsRoutes.post("/search", createSearchEventHandler);
eventsRoutes.post("/add-to-cart", createAddToCartEventHandler);
eventsRoutes.post("/remove-from-cart", createRemoveFromCartEventHandler);
eventsRoutes.post("/idle", createIdleEventHandler);
eventsRoutes.post("/click", createClickEventHandler);
eventsRoutes.post("/scroll", createScrollEventHandler);
eventsRoutes.post("/filter-change", createFilterChangeEventHandler);
