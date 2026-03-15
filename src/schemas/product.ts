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
  imageUrl: z.string().url().optional(),
});

export const productsSchema = z.array(productSchema);

const optionalNonNegativeNumber = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().nonnegative().optional(),
);

export const productsQuerySchema = z
  .object({
    category: z.string().optional(),
    q: z.string().optional(),
    minPrice: optionalNonNegativeNumber,
    maxPrice: optionalNonNegativeNumber,
    priceRange: priceRangeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(120),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      query.minPrice <= query.maxPrice,
    {
      path: ["maxPrice"],
      message: "maxPrice must be greater than or equal to minPrice",
    },
  );
