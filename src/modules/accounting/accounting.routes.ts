import { Router } from 'express';
import { accountingController } from './accounting.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import { createIncomeSchema, createExpenseSchema, accountingListQuery } from './accounting.dto';

const router = Router();
router.use(authenticate);

router.post('/income', authorize('income.create'), validate(createIncomeSchema), asyncHandler(accountingController.createIncome));
router.get('/income', authorize('accounting.read'), validate(accountingListQuery, 'query'), asyncHandler(accountingController.listIncome));
router.post('/expenses', authorize('expenses.create'), validate(createExpenseSchema), asyncHandler(accountingController.createExpense));
router.get('/expenses', authorize('accounting.read'), validate(accountingListQuery, 'query'), asyncHandler(accountingController.listExpenses));

export default router;
