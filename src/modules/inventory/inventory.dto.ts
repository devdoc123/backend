import { z } from 'zod';

export const createItemSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().int().nonnegative().default(0),
  unitPrice: z.number().nonnegative().default(0),
  costPrice: z.number().nonnegative().default(0),
  reorderLevel: z.number().int().nonnegative().default(0),
});

export const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unitPrice: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const purchaseSchema = z.object({
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  note: z.string().optional(),
});

export const sellSchema = z.object({
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  memberId: z.string().uuid().nullable().optional(),
  note: z.string().optional(),
});

export const listItemsQuery = z.object({ activeOnly: z.coerce.boolean().optional() });
