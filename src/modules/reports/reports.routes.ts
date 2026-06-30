import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../utils/http';
import { reportsService } from './reports.service';
import { today, addDays } from '../../utils/dates';

const router = Router();
router.use(authenticate);

const rangeQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const dateQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
const stoppedQuery = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

function range(q: any) {
  const to = q.to ?? today();
  const from = q.from ?? addDays(to, -29);
  return { from, to };
}

const fin = authorize('reports.financial');
const op = authorize('reports.operational');

router.get('/daily-cash', fin, validate(dateQuery, 'query'), asyncHandler(async (req, res) => {
  const q = (req as any).validatedQuery ?? {};
  return ok(res, await reportsService.dailyCash(q.date ?? today()));
}));

router.get('/monthly-revenue', fin, validate(yearQuery, 'query'), asyncHandler(async (req, res) => {
  const q = (req as any).validatedQuery ?? {};
  return ok(res, await reportsService.monthlyRevenue(q.year ?? new Date().getUTCFullYear()));
}));

router.get('/profit-loss', fin, validate(rangeQuery, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = range((req as any).validatedQuery ?? {});
  return ok(res, await reportsService.profitAndLoss(from, to));
}));

router.get('/expenses', fin, validate(rangeQuery, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = range((req as any).validatedQuery ?? {});
  return ok(res, await reportsService.expenseReport(from, to));
}));

router.get('/collection-trend', fin, validate(rangeQuery, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = range((req as any).validatedQuery ?? {});
  return ok(res, await reportsService.collectionTrend(from, to));
}));

router.get('/trainer-revenue', fin, validate(rangeQuery, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = range((req as any).validatedQuery ?? {});
  return ok(res, await reportsService.trainerRevenue(from, to));
}));

router.get('/plan-performance', op, validate(rangeQuery, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = range((req as any).validatedQuery ?? {});
  return ok(res, await reportsService.planPerformance(from, to));
}));

router.get('/membership-growth', op, validate(yearQuery, 'query'), asyncHandler(async (req, res) => {
  const q = (req as any).validatedQuery ?? {};
  return ok(res, await reportsService.membershipGrowth(q.year ?? new Date().getUTCFullYear()));
}));

router.get('/stopped-coming', op, validate(stoppedQuery, 'query'), asyncHandler(async (req, res) => {
  const q = (req as any).validatedQuery ?? {};
  return ok(res, await reportsService.stoppedComing(q.days ?? 14, q.limit ?? 100));
}));

router.get('/owner-snapshot', op, asyncHandler(async (_req, res) => ok(res, await reportsService.ownerSnapshot())));

export default router;
