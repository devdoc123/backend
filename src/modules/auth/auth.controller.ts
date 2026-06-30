import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authService } from './auth.service';
import { usersRepository } from '../users/users.repository';
import { ok } from '../../utils/http';
import { BadRequest, Unauthorized } from '../../utils/errors';
import { auditService } from '../audit/audit.service';

function ctxFrom(req: Request) {
  return {
    userAgent: req.headers['user-agent'] ?? null,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
  };
}

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const result = await authService.login(email, password, ctxFrom(req));
    await auditService.record({
      actorId: result.user.id,
      actorName: result.user.name,
      action: 'auth.login',
      entityType: 'user',
      entityId: result.user.id,
      description: `${result.user.email} logged in`,
      ipAddress: ctxFrom(req).ipAddress,
    });
    return ok(res, result);
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken, ctxFrom(req));
    return ok(res, result);
  },

  async logout(req: Request, res: Response) {
    const { refreshToken } = req.body;
    if (refreshToken) await authService.logout(refreshToken);
    return ok(res, { loggedOut: true });
  },

  async me(req: Request, res: Response) {
    if (!req.user) throw Unauthorized();
    const me = await authService.me(req.user.sub);
    return ok(res, me);
  },

  async changePassword(req: Request, res: Response) {
    if (!req.user) throw Unauthorized();
    const { currentPassword, newPassword } = req.body;
    const user = await usersRepository.findById(req.user.sub);
    if (!user) throw Unauthorized();
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw BadRequest('Current password is incorrect');
    const hash = await bcrypt.hash(newPassword, 12);
    await usersRepository.setPassword(user.id, hash);
    await authService.logoutAll(user.id); // force re-login everywhere
    await auditService.record({
      actorId: user.id,
      actorName: user.full_name,
      action: 'auth.change_password',
      entityType: 'user',
      entityId: user.id,
    });
    return ok(res, { changed: true });
  },
};
