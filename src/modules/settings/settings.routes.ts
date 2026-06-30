import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../utils/http';
import { settingsRepository } from './settings.repository';
import { auditService } from '../audit/audit.service';

const router = Router();
router.use(authenticate);

const updateSchema = z.object({
  gymName: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  currency: z.string().min(1).max(8).optional(),
  defaultGracePeriodDays: z.number().int().nonnegative().optional(),
  reminderOffsets: z.array(z.number().int()).optional(),
  reminderTemplate: z.string().min(1).optional(),
});

// Any authenticated user can read settings (currency, gym name needed app-wide)
router.get('/', asyncHandler(async (_req, res) => ok(res, await settingsRepository.get())));

router.patch('/', authorize('settings.manage'), validate(updateSchema), asyncHandler(async (req, res) => {
  const settings = await settingsRepository.update(req.body);
  await auditService.record({
    actorId: req.user!.sub, actorName: req.user!.name,
    action: 'settings.update', entityType: 'settings', metadata: req.body,
  });
  return ok(res, settings);
}));

export default router;
