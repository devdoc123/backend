import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok, created } from '../../utils/http';
import { remindersService } from './reminders.service';

const router = Router();
router.use(authenticate);

const logSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  memberId: z.string().uuid(),
  reminderType: z.string().min(1),
  message: z.string().min(1),
});

router.get('/pending', authorize('reminders.read'), asyncHandler(async (_req, res) => {
  return ok(res, await remindersService.pending());
}));

router.get('/invoice/:invoiceId', authorize('reminders.read'), asyncHandler(async (req, res) => {
  return ok(res, await remindersService.forInvoice(req.params.invoiceId));
}));

router.post('/log', authorize('reminders.read'), validate(logSchema), asyncHandler(async (req, res) => {
  await remindersService.logSent({ ...req.body, sentBy: req.user!.sub });
  return created(res, { logged: true });
}));

export default router;
