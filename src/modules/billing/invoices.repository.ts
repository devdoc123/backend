import { PoolClient } from 'pg';
import { query } from '../../db/pool';

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  member_id: string;
  membership_id: string | null;
  total_amount: string;
  amount_paid: string;
  balance: string;
  status: string;
  due_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const invoicesRepository = {
  async create(
    client: PoolClient,
    data: {
      invoiceNumber: string;
      memberId: string;
      membershipId: string;
      totalAmount: number;
      dueDate: string;
      notes?: string | null;
      createdBy: string;
    }
  ): Promise<InvoiceRow> {
    const res = await client.query<InvoiceRow>(
      `INSERT INTO invoices (invoice_number, member_id, membership_id, total_amount, amount_paid, balance, status, due_date, notes, created_by)
       VALUES ($1,$2,$3,$4,0,$4,'unpaid',$5,$6,$7)
       RETURNING *`,
      [data.invoiceNumber, data.memberId, data.membershipId, data.totalAmount, data.dueDate, data.notes ?? null, data.createdBy]
    );
    return res.rows[0];
  },

  async findById(id: string, client?: PoolClient): Promise<InvoiceRow | null> {
    const runner = client ? client.query.bind(client) : query;
    const res = await runner('SELECT * FROM invoices WHERE id = $1', [id]);
    return (res.rows[0] as InvoiceRow) ?? null;
  },

  /** Recompute amount_paid/balance/status from the payments ledger. */
  async recalculate(client: PoolClient, invoiceId: string): Promise<InvoiceRow> {
    const res = await client.query<InvoiceRow>(
      `UPDATE invoices i SET
         amount_paid = COALESCE(p.total, 0),
         balance = i.total_amount - COALESCE(p.total, 0),
         status = CASE
           WHEN i.status = 'void' THEN 'void'
           WHEN COALESCE(p.total,0) <= 0 THEN 'unpaid'
           WHEN COALESCE(p.total,0) >= i.total_amount THEN 'paid'
           ELSE 'partial'
         END
       FROM (SELECT invoice_id, SUM(amount) AS total FROM payments WHERE invoice_id = $1 GROUP BY invoice_id) p
       WHERE i.id = $1
       RETURNING i.*`,
      [invoiceId]
    );
    // when no payments exist the UPDATE...FROM yields no rows; fall back to a direct reset
    if (res.rows[0]) return res.rows[0];
    const reset = await client.query<InvoiceRow>(
      `UPDATE invoices SET amount_paid = 0, balance = total_amount,
         status = CASE WHEN status = 'void' THEN 'void' ELSE 'unpaid' END
       WHERE id = $1 RETURNING *`,
      [invoiceId]
    );
    return reset.rows[0];
  },

  async listForMember(memberId: string): Promise<InvoiceRow[]> {
    const res = await query<InvoiceRow>(
      'SELECT * FROM invoices WHERE member_id = $1 ORDER BY created_at DESC',
      [memberId]
    );
    return res.rows;
  },

  /** Outstanding dues with member context for dues report & reminders. */
  async listDues(params: { dueBefore?: string; limit: number; offset: number }): Promise<{ rows: any[]; total: number }> {
    const conditions = ["i.status IN ('unpaid','partial')", 'i.balance > 0'];
    const values: unknown[] = [];
    let idx = 1;
    if (params.dueBefore) {
      conditions.push(`i.due_date <= $${idx++}`);
      values.push(params.dueBefore);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const totalRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM invoices i ${where}`,
      values
    );
    const rowsRes = await query(
      `SELECT i.*, m.full_name, m.phone, m.member_code
       FROM invoices i JOIN members m ON m.id = i.member_id
       ${where}
       ORDER BY i.due_date ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset]
    );
    return { rows: rowsRes.rows, total: Number(totalRes.rows[0].count) };
  },

  async totalOutstanding(): Promise<number> {
    const res = await query<{ total: string }>(
      `SELECT COALESCE(SUM(balance),0)::text AS total FROM invoices WHERE status IN ('unpaid','partial')`
    );
    return Number(res.rows[0].total);
  },
};
