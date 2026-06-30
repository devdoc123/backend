import { Router } from 'express';
import { attendanceController } from './attendance.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import { markAttendanceSchema, attendanceListQuery, inactiveQuery } from './attendance.dto';

const router = Router();
router.use(authenticate);

router.post('/', authorize('attendance.mark'), validate(markAttendanceSchema), asyncHandler(attendanceController.mark));
router.get('/', authorize('attendance.read'), validate(attendanceListQuery, 'query'), asyncHandler(attendanceController.listForDate));
router.get('/inactive', authorize('attendance.read'), validate(inactiveQuery, 'query'), asyncHandler(attendanceController.inactive));
router.get('/member/:memberId', authorize('attendance.read'), asyncHandler(attendanceController.memberHistory));

export default router;
