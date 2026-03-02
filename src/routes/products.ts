import { Hono } from "hono";
import {
  getCatalogStats,
  getProductById,
  listProducts,
} from "../services/product-service.js";

export const productsRoutes = new Hono();

productsRoutes.get("/", (c) => {
  const result = listProducts(c.req.query());
  return c.json({ ...result, ...getCatalogStats() });
});

productsRoutes.get("/:id", (c) => {
  const id = c.req.param("id");
  const product = getProductById(id);

  if (!product) {
    return c.json({ error: "Product not found", code: "PRODUCT_NOT_FOUND" }, 404);
  }

  return c.json(product);
});
