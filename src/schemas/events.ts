import { z } from "zod";

export const productViewBodySchema = z.object({
  productId: z.string().min(1),
  viewDuration: z.number().int().nonnegative().optional(),
});

export type ProductViewBody = z.infer<typeof productViewBodySchema>;
