import { Request, Response } from 'express';
import { membersService } from './members.service';
import { ok, created, noContent, parsePagination, paginatedMeta } from '../../utils/http';

function actor(req: Request) {
  return {
    id: req.user!.sub,
    name: req.user!.name,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
  };
}

export const membersController = {
  async list(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const pagination = parsePagination({ query: q } as Request);
    const { rows, total } = await membersService.list({
      search: q.search,
      status: q.status,
      membershipState: q.membershipState,
      trainerId: q.trainerId,
      limit: pagination.pageSize,
      offset: pagination.offset,
    });
    return ok(res, rows, paginatedMeta(total, pagination));
  },

  async get(req: Request, res: Response) {
    const member = await membersService.get(req.params.id);
    return ok(res, member);
  },

  async search(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const results = await membersService.search(q.q, q.limit ?? 10);
    return ok(res, results);
  },

  async create(req: Request, res: Response) {
    const member = await membersService.create(req.body, actor(req));
    return created(res, member);
  },

  async update(req: Request, res: Response) {
    const member = await membersService.update(req.params.id, req.body, actor(req));
    return ok(res, member);
  },

  async remove(req: Request, res: Response) {
    await membersService.remove(req.params.id, actor(req));
    return noContent(res);
  },
};
