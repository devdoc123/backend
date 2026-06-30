import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import { authLimiter } from '../../middleware/rateLimit';
import { loginSchema, refreshSchema, changePasswordSchema } from './auth.dto';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(authController.refresh));
router.post('/logout', validate(refreshSchema.partial()), asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword)
);

export default router;
