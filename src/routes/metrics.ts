import { Hono } from "hono";
import { getPersonalizationMetricsHandler } from "../controllers/personalization-metrics-controller.js";

export const metricsRoutes = new Hono();

metricsRoutes.get("/personalization", getPersonalizationMetricsHandler);
