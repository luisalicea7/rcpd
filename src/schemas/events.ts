import { z } from "zod";

export const pageViewBodySchema = z.object({
  page: z.string().min(1),
  referrer: z.string().min(1).optional(),
});

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

export const idleEventBodySchema = z.object({
  idleDuration: z.number().int().nonnegative(),
  page: z.string().min(1),
});

export const clickEventBodySchema = z.object({
  element: z.string().min(1),
  page: z.string().min(1),
});

export const scrollEventBodySchema = z.object({
  depth: z.number().min(0).max(100),
  page: z.string().min(1),
});

export const filterChangeEventBodySchema = z.object({
  filter: z.string().min(1),
  value: z.string().min(1),
});

export type PageViewBody = z.infer<typeof pageViewBodySchema>;
export type ProductViewBody = z.infer<typeof productViewBodySchema>;
export type SearchEventBody = z.infer<typeof searchEventBodySchema>;
export type AddToCartBody = z.infer<typeof addToCartBodySchema>;
export type RemoveFromCartBody = z.infer<typeof removeFromCartBodySchema>;
export type IdleEventBody = z.infer<typeof idleEventBodySchema>;
export type ClickEventBody = z.infer<typeof clickEventBodySchema>;
export type ScrollEventBody = z.infer<typeof scrollEventBodySchema>;
export type FilterChangeEventBody = z.infer<typeof filterChangeEventBodySchema>;
