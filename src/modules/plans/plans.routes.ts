import { Router } from 'express';
import { plansController } from './plans.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import { createPlanSchema, updatePlanSchema, listPlansQuery } from './plans.dto';

const router = Router();
router.use(authenticate);

router.get('/', authorize('plans.read'), validate(listPlansQuery, 'query'), asyncHandler(plansController.list));
router.get('/:id', authorize('plans.read'), asyncHandler(plansController.get));
router.post('/', authorize('plans.manage'), validate(createPlanSchema), asyncHandler(plansController.create));
router.patch('/:id', authorize('plans.manage'), validate(updatePlanSchema), asyncHandler(plansController.update));

export default router;
