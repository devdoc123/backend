import { z } from 'zod';

const phone = z.string().min(7).max(20);

export const createMemberSchema = z.object({
  fullName: z.string().min(2),
  fatherName: z.string().optional(),
  phone,
  emergencyContact: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  heightCm: z.number().positive().max(300).optional(),
  weightKg: z.number().positive().max(500).optional(),
  goal: z.string().optional(),
  medicalNotes: z.string().optional(),
  notes: z.string().optional(),
  trainerId: z.string().uuid().nullable().optional(),
});

export const updateMemberSchema = z.object({
  fullName: z.string().min(2).optional(),
  fatherName: z.string().nullable().optional(),
  phone: phone.optional(),
  emergencyContact: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  goal: z.string().nullable().optional(),
  medicalNotes: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive', 'frozen']).optional(),
  notes: z.string().nullable().optional(),
  trainerId: z.string().uuid().nullable().optional(),
});

export const listMembersQuery = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'frozen']).optional(),
  membershipState: z.enum(['active', 'expired', 'grace', 'none']).optional(),
  trainerId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const searchQuery = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().max(25).optional(),
});
