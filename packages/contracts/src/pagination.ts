import { z } from 'zod';

export const CursorPaginationInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});
export type CursorPaginationInput = z.infer<typeof CursorPaginationInputSchema>;

export const CursorPaginationMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.number().int().nonnegative().optional(),
});
export type CursorPaginationMeta = z.infer<typeof CursorPaginationMetaSchema>;

export function paginatedResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: CursorPaginationMetaSchema,
  });
}
