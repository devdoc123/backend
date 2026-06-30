import { Request, Response } from 'express';
import { plansRepository } from './plans.repository';
import { ok, created } from '../../utils/http';
import { NotFound } from '../../utils/errors';
import { auditService } from '../audit/audit.service';

export const plansController = {
  async list(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const plans = await plansRepository.list(q.activeOnly);
    return ok(res, plans);
  },

  async get(req: Request, res: Response) {
    const plan = await plansRepository.findById(req.params.id);
    if (!plan) throw NotFound('Plan not found');
    return ok(res, plan);
  },

  async create(req: Request, res: Response) {
    const plan = await plansRepository.create(req.body);
    await auditService.record({
      actorId: req.user!.sub,
      actorName: req.user!.name,
      action: 'plan.create',
      entityType: 'plan',
      entityId: plan.id,
      description: `Created plan ${plan.name}`,
    });
    return created(res, plan);
  },

  async update(req: Request, res: Response) {
    const existing = await plansRepository.findById(req.params.id);
    if (!existing) throw NotFound('Plan not found');
    const plan = await plansRepository.update(req.params.id, req.body);
    await auditService.record({
      actorId: req.user!.sub,
      actorName: req.user!.name,
      action: 'plan.update',
      entityType: 'plan',
      entityId: req.params.id,
      metadata: req.body,
    });
    return ok(res, plan);
  },
};
