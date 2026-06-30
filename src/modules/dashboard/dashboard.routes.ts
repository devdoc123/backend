import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler, ok } from '../../utils/http';
import { dashboardService } from './dashboard.service';

const router = Router();
router.use(authenticate);

router.get('/summary', authorize('dashboard.view'), asyncHandler(async (_req, res) => ok(res, await dashboardService.summary())));
router.get('/charts', authorize('dashboard.view'), asyncHandler(async (_req, res) => ok(res, await dashboardService.charts())));

export default router;
