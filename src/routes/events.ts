import { Hono } from "hono";
import { createProductViewEventHandler } from "../controllers/events-controller.js";
import { requireConsent } from "../middleware/consent.js";

export const eventsRoutes = new Hono();

eventsRoutes.use("*", requireConsent);

eventsRoutes.post("/product-view", createProductViewEventHandler);
