import { Hono } from "hono";
import { getMyPersonalizationHandler } from "../controllers/personalization-controller.js";

export const personalizationRoutes = new Hono();

personalizationRoutes.get("/me", getMyPersonalizationHandler);
