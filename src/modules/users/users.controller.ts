import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { usersRepository } from './users.repository';
import { ok, created } from '../../utils/http';
import { BadRequest, Conflict, NotFound } from '../../utils/errors';
import { auditService } from '../audit/audit.service';

function actor(req: Request) {
  return { id: req.user!.sub, name: req.user!.name };
}

export const usersController = {
  async list(req: Request, res: Response) {
    const q = (req as any).validatedQuery ?? {};
    const users = await usersRepository.list({ role: q.role, activeOnly: q.activeOnly });
    return ok(res, users);
  },

  async get(req: Request, res: Response) {
    const user = await usersRepository.findPublicById(req.params.id);
    if (!user) throw NotFound('User not found');
    return ok(res, user);
  },

  async create(req: Request, res: Response) {
    const { email, password, fullName, role, phone, commissionRate } = req.body;
    const existing = await usersRepository.findByEmail(email);
    if (existing) throw Conflict('A user with this email already exists');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await usersRepository.create({ email, passwordHash, fullName, role, phone, commissionRate });
    await auditService.record({
      actorId: actor(req).id,
      actorName: actor(req).name,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      description: `Created ${role} ${email}`,
    });
    return created(res, user);
  },

  async update(req: Request, res: Response) {
    const target = await usersRepository.findById(req.params.id);
    if (!target) throw NotFound('User not found');
    const updated = await usersRepository.update(req.params.id, req.body);
    await auditService.record({
      actorId: actor(req).id,
      actorName: actor(req).name,
      action: 'user.update',
      entityType: 'user',
      entityId: req.params.id,
      metadata: req.body,
    });
    return ok(res, updated);
  },

  async setActive(req: Request, res: Response, active: boolean) {
    const target = await usersRepository.findById(req.params.id);
    if (!target) throw NotFound('User not found');
    if (target.role === 'owner' && !active) {
      const owners = await usersRepository.list({ role: 'owner', activeOnly: true });
      if (owners.length <= 1) throw BadRequest('Cannot disable the only active owner');
    }
    const updated = await usersRepository.update(req.params.id, { isActive: active });
    await auditService.record({
      actorId: actor(req).id,
      actorName: actor(req).name,
      action: active ? 'user.enable' : 'user.disable',
      entityType: 'user',
      entityId: req.params.id,
    });
    return ok(res, updated);
  },

  async resetPassword(req: Request, res: Response) {
    const target = await usersRepository.findById(req.params.id);
    if (!target) throw NotFound('User not found');
    const hash = await bcrypt.hash(req.body.newPassword, 12);
    await usersRepository.setPassword(req.params.id, hash);
    await auditService.record({
      actorId: actor(req).id,
      actorName: actor(req).name,
      action: 'user.reset_password',
      entityType: 'user',
      entityId: req.params.id,
    });
    return ok(res, { reset: true });
  },
};
