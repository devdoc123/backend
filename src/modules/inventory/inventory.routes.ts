import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import { createItemSchema, updateItemSchema, purchaseSchema, sellSchema, listItemsQuery } from './inventory.dto';

const router = Router();
router.use(authenticate);

router.get('/', authorize('inventory.read'), validate(listItemsQuery, 'query'), asyncHandler(inventoryController.list));
router.get('/low-stock', authorize('inventory.read'), asyncHandler(inventoryController.lowStock));
router.get('/:id', authorize('inventory.read'), asyncHandler(inventoryController.detail));
router.post('/', authorize('inventory.manage'), validate(createItemSchema), asyncHandler(inventoryController.create));
router.patch('/:id', authorize('inventory.manage'), validate(updateItemSchema), asyncHandler(inventoryController.update));
router.post('/:id/purchase', authorize('inventory.manage'), validate(purchaseSchema), asyncHandler(inventoryController.purchase));
router.post('/:id/sell', authorize('inventory.manage'), validate(sellSchema), asyncHandler(inventoryController.sell));

export default router;
