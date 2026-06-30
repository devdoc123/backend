import { Request, Response } from 'express';
import { inventoryService } from './inventory.service';
import { ok, created } from '../../utils/http';

function actor(req: Request) {
  return { id: req.user!.sub, name: req.user!.name, ip: req.ip ?? null };
}

export const inventoryController = {
  async list(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    return ok(res, await inventoryService.list(Boolean(q.activeOnly)));
  },
  async lowStock(_req: Request, res: Response) {
    return ok(res, await inventoryService.lowStock());
  },
  async detail(req: Request, res: Response) {
    return ok(res, await inventoryService.detail(req.params.id));
  },
  async create(req: Request, res: Response) {
    return created(res, await inventoryService.create(req.body, actor(req)));
  },
  async update(req: Request, res: Response) {
    return ok(res, await inventoryService.update(req.params.id, req.body, actor(req)));
  },
  async purchase(req: Request, res: Response) {
    return created(res, await inventoryService.purchase(req.params.id, req.body, actor(req)));
  },
  async sell(req: Request, res: Response) {
    return created(res, await inventoryService.sell(req.params.id, req.body, actor(req)));
  },
};
