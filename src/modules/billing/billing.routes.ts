import { Router } from 'express';
import { billingController } from './billing.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import {
  createMembershipSchema,
  renewMembershipSchema,
  recordPaymentSchema,
  duesQuery,
} from './billing.dto';

const router = Router();
router.use(authenticate);

// Memberships
router.post('/memberships', authorize('memberships.create'), validate(createMembershipSchema), asyncHandler(billingController.createMembership));
router.post('/members/:memberId/renew', authorize('memberships.renew'), validate(renewMembershipSchema), asyncHandler(billingController.renewMembership));
router.get('/members/:memberId/ledger', authorize('payments.read'), asyncHandler(billingController.memberLedger));

// Invoices & payments
router.get('/invoices/:invoiceId', authorize('payments.read'), asyncHandler(billingController.getInvoice));
router.post('/invoices/:invoiceId/payments', authorize('payments.create'), validate(recordPaymentSchema), asyncHandler(billingController.recordPayment));
router.get('/payments/:paymentId/receipt', authorize('payments.read'), asyncHandler(billingController.getReceipt));

// Dues
router.get('/dues', authorize('dues.read'), validate(duesQuery, 'query'), asyncHandler(billingController.dues));

export default router;
