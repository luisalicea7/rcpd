import { z } from "zod";

export const addCartItemBodySchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
});

export const updateCartItemBodySchema = z.object({
  quantity: z.coerce.number().int().positive(),
});

export type AddCartItemBody = z.infer<typeof addCartItemBodySchema>;
export type UpdateCartItemBody = z.infer<typeof updateCartItemBodySchema>;
