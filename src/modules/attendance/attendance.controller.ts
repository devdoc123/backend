import { Request, Response } from 'express';
import { attendanceService } from './attendance.service';
import { ok, created, parsePagination, paginatedMeta } from '../../utils/http';
import { today, addDays } from '../../utils/dates';

function actor(req: Request) {
  return {
    id: req.user!.sub,
    name: req.user!.name,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
  };
}

export const attendanceController = {
  async mark(req: Request, res: Response) {
    const { memberId, allowExpired } = req.body;
    const result = await attendanceService.mark(memberId, actor(req), Boolean(allowExpired));
    return created(res, result);
  },

  async listForDate(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const date = q.date ?? today();
    const pagination = parsePagination({ query: q } as Request, 50);
    const { rows, total } = await attendanceService.listForDate(date, pagination.pageSize, pagination.offset);
    return ok(res, rows, { ...paginatedMeta(total, pagination), date });
  },

  async memberHistory(req: Request, res: Response) {
    const rows = await attendanceService.memberHistory(req.params.memberId);
    return ok(res, rows);
  },

  async inactive(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const days = q.days ?? 14;
    const since = addDays(today(), -days);
    const rows = await attendanceService.inactiveMembers(since, q.limit ?? 50);
    return ok(res, rows, { since, days });
  },
};
