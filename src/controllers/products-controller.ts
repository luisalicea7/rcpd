import type { Context } from "hono";
import { ZodError } from "zod";
import {
  getCatalogStats,
  getProductById,
  listProducts,
} from "../services/product-service.js";

export async function listProductsHandler(c: Context): Promise<Response> {
  try {
    const result = listProducts(c.req.query());
    return c.json({ ...result, ...getCatalogStats() });
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json(
        {
          error: "Invalid query parameters",
          code: "INVALID_QUERY",
          details: err.issues,
        },
        400,
      );
    }

    throw err;
  }
}

export function getProductByIdHandler(c: Context): Response {
  const id = c.req.param("id");
  const product = getProductById(id);

  if (!product) {
    return c.json({ error: "Product not found", code: "PRODUCT_NOT_FOUND" }, 404);
  }

  return c.json(product);
}
