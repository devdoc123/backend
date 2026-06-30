import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const method = z.enum(['cash', 'card', 'bank_transfer', 'jazzcash', 'easypaisa', 'other']);

const paymentInput = z.object({
  amount: z.number().positive(),
  method,
  reference: z.string().optional(),
  note: z.string().optional(),
});

export const createMembershipSchema = z.object({
  memberId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: dateStr.optional(),
  discount: z.number().nonnegative().optional(),
  priceOverride: z.number().nonnegative().optional(),
  includeRegistration: z.boolean().optional(),
  dueDate: dateStr.optional(),
  trainerId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  initialPayment: paymentInput.optional(),
});

export const renewMembershipSchema = z.object({
  planId: z.string().uuid(),
  discount: z.number().nonnegative().optional(),
  priceOverride: z.number().nonnegative().optional(),
  dueDate: dateStr.optional(),
  initialPayment: paymentInput.optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  method,
  reference: z.string().optional(),
  note: z.string().optional(),
  paidAt: z.string().datetime().optional(),
});

export const duesQuery = z.object({
  dueBefore: dateStr.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
