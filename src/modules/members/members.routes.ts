import { Router } from 'express';
import { membersController } from './members.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import { createMemberSchema, updateMemberSchema, listMembersQuery, searchQuery } from './members.dto';

const router = Router();
router.use(authenticate);

router.get('/', authorize('members.read'), validate(listMembersQuery, 'query'), asyncHandler(membersController.list));
router.get('/search', authorize('members.read'), validate(searchQuery, 'query'), asyncHandler(membersController.search));
router.get('/:id', authorize('members.read'), asyncHandler(membersController.get));
router.post('/', authorize('members.create'), validate(createMemberSchema), asyncHandler(membersController.create));
router.patch('/:id', authorize('members.update'), validate(updateMemberSchema), asyncHandler(membersController.update));
router.delete('/:id', authorize('members.delete'), asyncHandler(membersController.remove));

export default router;
