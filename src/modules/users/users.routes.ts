import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import { createUserSchema, updateUserSchema, resetPasswordSchema, listUsersQuery } from './users.dto';

const router = Router();

router.use(authenticate);

router.get('/', authorize('users.manage'), validate(listUsersQuery, 'query'), asyncHandler(usersController.list));
router.get('/:id', authorize('users.manage'), asyncHandler(usersController.get));
router.post('/', authorize('users.manage'), validate(createUserSchema), asyncHandler(usersController.create));
router.patch('/:id', authorize('users.manage'), validate(updateUserSchema), asyncHandler(usersController.update));
router.post('/:id/enable', authorize('users.manage'), asyncHandler((req, res) => usersController.setActive(req, res, true)));
router.post('/:id/disable', authorize('users.manage'), asyncHandler((req, res) => usersController.setActive(req, res, false)));
router.post('/:id/reset-password', authorize('users.manage'), validate(resetPasswordSchema), asyncHandler(usersController.resetPassword));

export default router;
