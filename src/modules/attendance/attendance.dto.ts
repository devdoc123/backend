import { z } from 'zod';

export const markAttendanceSchema = z.object({
  memberId: z.string().uuid(),
  allowExpired: z.boolean().optional(),
});

export const attendanceListQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const inactiveQuery = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
