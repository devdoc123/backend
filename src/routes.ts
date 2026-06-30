import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import plansRoutes from './modules/plans/plans.routes';
import membersRoutes from './modules/members/members.routes';
import billingRoutes from './modules/billing/billing.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import accountingRoutes from './modules/accounting/accounting.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import reportsRoutes from './modules/reports/reports.routes';
import searchRoutes from './modules/search/search.routes';
import remindersRoutes from './modules/reminders/reminders.routes';
import settingsRoutes from './modules/settings/settings.routes';
import trainersRoutes from './modules/trainers/trainers.routes';
import auditRoutes from './modules/audit/audit.routes';
import exportRoutes from './modules/export/export.routes';
import { sseHandler } from './realtime/sse.controller';
import { asyncHandler } from './utils/http';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/plans', plansRoutes);
router.use('/members', membersRoutes);
router.use('/billing', billingRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/accounting', accountingRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/search', searchRoutes);
router.use('/reminders', remindersRoutes);
router.use('/settings', settingsRoutes);
router.use('/trainers', trainersRoutes);
router.use('/audit', auditRoutes);
router.use('/export', exportRoutes);

// Realtime stream (auth via ?token= query param)
router.get('/events', asyncHandler(async (req, res) => sseHandler(req, res)));

export default router;
