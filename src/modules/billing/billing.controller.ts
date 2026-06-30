import { Request, Response } from 'express';
import { billingService } from './billing.service';
import { ok, created, parsePagination, paginatedMeta } from '../../utils/http';

function actor(req: Request) {
  return {
    id: req.user!.sub,
    name: req.user!.name,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
  };
}

export const billingController = {
  async createMembership(req: Request, res: Response) {
    const result = await billingService.createMembership(req.body, actor(req));
    return created(res, result);
  },

  async renewMembership(req: Request, res: Response) {
    const result = await billingService.renewMembership(req.params.memberId, req.body, actor(req));
    return created(res, result);
  },

  async recordPayment(req: Request, res: Response) {
    const result = await billingService.recordPayment(req.params.invoiceId, req.body, actor(req));
    return created(res, result);
  },

  async memberLedger(req: Request, res: Response) {
    const ledger = await billingService.memberLedger(req.params.memberId);
    return ok(res, ledger);
  },

  async getInvoice(req: Request, res: Response) {
    const result = await billingService.getInvoice(req.params.invoiceId);
    return ok(res, result);
  },

  async getReceipt(req: Request, res: Response) {
    const result = await billingService.getReceipt(req.params.paymentId);
    return ok(res, result);
  },

  async dues(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const pagination = parsePagination({ query: q } as Request, 50);
    const { rows, total } = await billingService.listDues({
      dueBefore: q.dueBefore,
      limit: pagination.pageSize,
      offset: pagination.offset,
    });
    return ok(res, rows, paginatedMeta(total, pagination));
  },
};
