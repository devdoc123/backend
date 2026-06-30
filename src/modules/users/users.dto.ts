import { z } from 'zod';
import { ROLES } from '../../auth/rbac';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  role: z.enum(ROLES),
  phone: z.string().min(7).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  phone: z.string().min(7).nullable().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export const listUsersQuery = z.object({
  role: z.enum(ROLES).optional(),
  activeOnly: z.coerce.boolean().optional(),
});
