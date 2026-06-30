import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationDays: z.number().int().positive(),
  price: z.number().nonnegative(),
  registrationFee: z.number().nonnegative().default(0),
  gracePeriodDays: z.number().int().nonnegative().default(5),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  durationDays: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  registrationFee: z.number().nonnegative().optional(),
  gracePeriodDays: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const listPlansQuery = z.object({
  activeOnly: z.coerce.boolean().optional(),
});
