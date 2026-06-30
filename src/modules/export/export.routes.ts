import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../utils/http';
import { query } from '../../db/pool';
import { BadRequest } from '../../utils/errors';
import { auditService } from '../audit/audit.service';

const router = Router();
router.use(authenticate);

const EXPORTS: Record<string, string> = {
  members: `SELECT member_code, full_name, father_name, phone, emergency_contact, gender,
                   date_of_birth, joining_date, status, goal FROM members ORDER BY created_at`,
  payments: `SELECT receipt_number, member_id, amount, method, reference, paid_at FROM payments ORDER BY paid_at`,
  invoices: `SELECT invoice_number, member_id, total_amount, amount_paid, balance, status, due_date FROM invoices ORDER BY created_at`,
  income: `SELECT category, amount, source, description, received_at FROM income ORDER BY received_at`,
  expenses: `SELECT category, amount, vendor, description, spent_at FROM expenses ORDER BY spent_at`,
  attendance: `SELECT member_id, attend_date, check_in_at FROM attendance ORDER BY check_in_at`,
  memberships: `SELECT member_id, plan_name, start_date, end_date, total_amount, status FROM memberships ORDER BY created_at`,
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\n');
}

/** Export a dataset as CSV. Owner-only (data.export permission). */
router.get('/:dataset.csv', authorize('data.export'), asyncHandler(async (req, res) => {
  const dataset = req.params.dataset;
  const sql = EXPORTS[dataset];
  if (!sql) throw BadRequest(`Unknown dataset. Available: ${Object.keys(EXPORTS).join(', ')}`);
  const result = await query(sql);
  const csv = toCsv(result.rows);
  await auditService.record({
    actorId: req.user!.sub, actorName: req.user!.name,
    action: 'data.export', entityType: 'export', entityId: dataset,
    description: `Exported ${dataset} (${result.rowCount} rows)`,
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${dataset}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

export default router;
