import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../utils/http';
import { membersService } from '../members/members.service';

const router = Router();
router.use(authenticate);

const q = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().max(25).optional(),
});

/**
 * Global search across members (name / phone / membership id).
 * Redis-cached for sub-100ms repeated lookups.
 */
router.get('/', authorize('members.read'), validate(q, 'query'), asyncHandler(async (req, res) => {
  const query = (req as any).validatedQuery;
  const members = await membersService.search(query.q, query.limit ?? 10);
  return ok(res, { members });
}));

export default router;
