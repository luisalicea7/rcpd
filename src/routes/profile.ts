import { Hono } from "hono";
import { getMyProfileHandler } from "../controllers/profile-controller.js";

export const profileRoutes = new Hono();

profileRoutes.get("/me", getMyProfileHandler);
