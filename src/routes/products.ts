import { Hono } from "hono";
import {
  getProductByIdHandler,
  listProductsHandler,
} from "../controllers/products-controller.js";

export const productsRoutes = new Hono();

productsRoutes.get("/", listProductsHandler);
productsRoutes.get("/:id", getProductByIdHandler);
