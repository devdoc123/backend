import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler, ok } from '../../utils/http';
import { membersRepository } from '../members/members.repository';
import { usersRepository } from '../users/users.repository';
import { Forbidden } from '../../utils/errors';

const router = Router();
router.use(authenticate);

/** Trainers see their own assigned members; managers/owners can view any trainer. */
router.get('/me/members', authorize('members.read'), asyncHandler(async (req, res) => {
  const members = await membersRepository.findByTrainer(req.user!.sub);
  return ok(res, members);
}));

router.get('/', authorize('trainers.read'), asyncHandler(async (_req, res) => {
  const trainers = await usersRepository.list({ role: 'trainer' });
  return ok(res, trainers);
}));

router.get('/:trainerId/members', authorize('trainers.read'), asyncHandler(async (req, res) => {
  // trainers may only read their own roster
  if (req.user!.role === 'trainer' && req.user!.sub !== req.params.trainerId) {
    throw Forbidden('Trainers can only view their own members');
  }
  const members = await membersRepository.findByTrainer(req.params.trainerId);
  return ok(res, members);
}));

export default router;
