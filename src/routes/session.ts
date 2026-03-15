import { Hono } from "hono";
import { sessionInfoHandler } from "../controllers/session-controller.js";

export const sessionRoutes = new Hono();

sessionRoutes.get("/info", sessionInfoHandler);