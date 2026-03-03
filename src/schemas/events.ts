import { z } from "zod";

export const productViewBodySchema = z.object({
  productId: z.string().min(1),
  viewDuration: z.number().int().nonnegative().optional(),
});

export const searchEventBodySchema = z.object({
  query: z.string().min(1),
  resultsCount: z.number().int().min(0),
});

export const addToCartBodySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export const removeFromCartBodySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export type ProductViewBody = z.infer<typeof productViewBodySchema>;
export type SearchEventBody = z.infer<typeof searchEventBodySchema>;
export type AddToCartBody = z.infer<typeof addToCartBodySchema>;
export type RemoveFromCartBody = z.infer<typeof removeFromCartBodySchema>;
