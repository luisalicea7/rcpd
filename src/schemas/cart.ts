import { z } from "zod";

const quantitySchema = z
  .union([
    z.number(),
    z.string().regex(/^\d+$/, "quantity must be a positive integer"),
  ])
  .transform((value) => (typeof value === "string" ? Number(value) : value))
  .refine((value) => Number.isInteger(value) && value > 0, {
    message: "quantity must be a positive integer",
  });

export const addCartItemBodySchema = z.object({
  productId: z.string().trim().min(1),
  quantity: quantitySchema.default(1),
});

export const updateCartItemBodySchema = z.object({
  quantity: quantitySchema,
});

export type AddCartItemBody = z.infer<typeof addCartItemBodySchema>;
export type UpdateCartItemBody = z.infer<typeof updateCartItemBodySchema>;
