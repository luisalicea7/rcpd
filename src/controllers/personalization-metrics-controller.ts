import type { Context } from "hono";
import { getPersonalizationMetrics } from "../services/personalization-metrics-service.js";

export async function getPersonalizationMetricsHandler(c: Context): Promise<Response> {
  const metrics = await getPersonalizationMetrics();
  return c.json(metrics);
}
