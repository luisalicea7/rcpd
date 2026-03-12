import { Hono } from "hono";
import {
  getMyProfileHandler,
  getProfileCompatHandler,
} from "../controllers/profile-controller.js";

export const profileRoutes = new Hono();

profileRoutes.get("/", getProfileCompatHandler);
profileRoutes.get("/me", getMyProfileHandler);
