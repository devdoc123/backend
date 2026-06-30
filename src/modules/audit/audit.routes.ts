import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok, parsePagination, paginatedMeta } from '../../utils/http';
import { auditService } from './audit.service';

const router = Router();
router.use(authenticate);

const q = z.object({
  entityType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

router.get('/', authorize('audit.read'), validate(q, 'query'), asyncHandler(async (req, res) => {
  const query = (req as any).validatedQuery ?? {};
  const pagination = parsePagination({ query } as any, 50);
  const { rows, total } = await auditService.list({
    limit: pagination.pageSize,
    offset: pagination.offset,
    entityType: query.entityType,
    actorId: query.actorId,
    action: query.action,
  });
  return ok(res, rows, paginatedMeta(total, pagination));
}));

export default router;
