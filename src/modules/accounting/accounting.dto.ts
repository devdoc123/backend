import { z } from 'zod';

export const createIncomeSchema = z.object({
  category: z.enum(['membership', 'registration', 'personal_training', 'supplement', 'other']),
  amount: z.number().positive(),
  source: z.string().optional(),
  memberId: z.string().uuid().nullable().optional(),
  trainerId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
});

export const createExpenseSchema = z.object({
  category: z.enum([
    'rent', 'salaries', 'electricity', 'maintenance', 'internet',
    'cleaning', 'equipment', 'marketing', 'miscellaneous',
  ]),
  amount: z.number().positive(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  spentAt: z.string().datetime().optional(),
});

export const accountingListQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
