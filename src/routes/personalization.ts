import { Hono } from "hono";
import {
  getMyPersonalizationHandler,
  getPersonalizationActionsCompatHandler,
  getPersonalizationHistoryCompatHandler,
} from "../controllers/personalization-controller.js";

export const personalizationRoutes = new Hono();

personalizationRoutes.get("/me", getMyPersonalizationHandler);
personalizationRoutes.get("/actions", getPersonalizationActionsCompatHandler);
personalizationRoutes.get("/history", getPersonalizationHistoryCompatHandler);
