import { z } from "zod";

export const priceRangeSchema = z.enum(["budget", "mid", "premium"]);

export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string().min(1),
  priceRange: priceRangeSchema,
  tags: z.array(z.string().min(1)).default([]),
  stock: z.number().int().nonnegative(),
});

export const productsSchema = z.array(productSchema);

export const productsQuerySchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  priceRange: priceRangeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
