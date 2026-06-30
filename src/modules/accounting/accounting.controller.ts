import { Request, Response } from 'express';
import { accountingRepository } from './accounting.repository';
import { ok, created, parsePagination, paginatedMeta } from '../../utils/http';
import { cache, CacheKeys } from '../../cache/cache';
import { realtimeBus } from '../../realtime/events';
import { auditService } from '../audit/audit.service';

function actor(req: Request) {
  return {
    id: req.user!.sub,
    name: req.user!.name,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
  };
}

async function invalidate() {
  await Promise.all([
    cache.invalidatePrefix(CacheKeys.dashboard),
    cache.invalidatePrefix(CacheKeys.reports),
    cache.invalidatePrefix(CacheKeys.stats),
  ]);
}

export const accountingController = {
  async createIncome(req: Request, res: Response) {
    const a = actor(req);
    const income = await accountingRepository.createIncome({ ...req.body, recordedBy: a.id });
    await invalidate();
    await auditService.record({
      actorId: a.id, actorName: a.name, action: 'income.create',
      entityType: 'income', entityId: income.id,
      description: `Recorded ${req.body.category} income ${income.amount}`, ipAddress: a.ip,
    });
    realtimeBus.emitEvent('income.recorded', { amount: Number(income.amount), category: income.category });
    return created(res, income);
  },

  async listIncome(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const pagination = parsePagination({ query: q } as Request, 50);
    const { rows, total, sum } = await accountingRepository.listIncome({
      from: q.from, to: q.to, category: q.category, limit: pagination.pageSize, offset: pagination.offset,
    });
    return ok(res, rows, { ...paginatedMeta(total, pagination), sum });
  },

  async createExpense(req: Request, res: Response) {
    const a = actor(req);
    const expense = await accountingRepository.createExpense({ ...req.body, recordedBy: a.id });
    await invalidate();
    await auditService.record({
      actorId: a.id, actorName: a.name, action: 'expense.create',
      entityType: 'expense', entityId: expense.id,
      description: `Recorded ${req.body.category} expense ${expense.amount}`, ipAddress: a.ip,
    });
    realtimeBus.emitEvent('expense.recorded', { amount: Number(expense.amount), category: expense.category });
    return created(res, expense);
  },

  async listExpenses(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const pagination = parsePagination({ query: q } as Request, 50);
    const { rows, total, sum } = await accountingRepository.listExpenses({
      from: q.from, to: q.to, category: q.category, limit: pagination.pageSize, offset: pagination.offset,
    });
    return ok(res, rows, { ...paginatedMeta(total, pagination), sum });
  },
};
