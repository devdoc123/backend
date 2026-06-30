import { PoolClient } from 'pg';
import { query } from '../../db/pool';

export interface IncomeRow {
  id: string;
  category: string;
  amount: string;
  source: string | null;
  member_id: string | null;
  trainer_id: string | null;
  payment_id: string | null;
  description: string | null;
  received_at: string;
  recorded_by: string | null;
}

export interface ExpenseRow {
  id: string;
  category: string;
  amount: string;
  vendor: string | null;
  description: string | null;
  spent_at: string;
  recorded_by: string | null;
}

export const accountingRepository = {
  async createIncome(
    data: {
      category: string;
      amount: number;
      source?: string | null;
      memberId?: string | null;
      trainerId?: string | null;
      paymentId?: string | null;
      description?: string | null;
      receivedAt?: string | null;
      recordedBy: string;
    },
    client?: PoolClient
  ): Promise<IncomeRow> {
    const runner = client ? client.query.bind(client) : query;
    const res = await runner(
      `INSERT INTO income (category, amount, source, member_id, trainer_id, payment_id, description, received_at, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, now()), $9)
       RETURNING *`,
      [
        data.category, data.amount, data.source ?? null, data.memberId ?? null, data.trainerId ?? null,
        data.paymentId ?? null, data.description ?? null, data.receivedAt ?? null, data.recordedBy,
      ]
    );
    return res.rows[0] as IncomeRow;
  },

  async createExpense(data: {
    category: string;
    amount: number;
    vendor?: string | null;
    description?: string | null;
    spentAt?: string | null;
    recordedBy: string;
  }): Promise<ExpenseRow> {
    const res = await query<ExpenseRow>(
      `INSERT INTO expenses (category, amount, vendor, description, spent_at, recorded_by)
       VALUES ($1,$2,$3,$4, COALESCE($5, now()), $6) RETURNING *`,
      [data.category, data.amount, data.vendor ?? null, data.description ?? null, data.spentAt ?? null, data.recordedBy]
    );
    return res.rows[0];
  },

  async listIncome(params: { from?: string; to?: string; category?: string; limit: number; offset: number }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (params.from) { conditions.push(`received_at >= $${idx++}`); values.push(params.from); }
    if (params.to) { conditions.push(`received_at < $${idx++}`); values.push(params.to); }
    if (params.category) { conditions.push(`category = $${idx++}`); values.push(params.category); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const totalRes = await query<{ count: string; sum: string }>(
      `SELECT COUNT(*)::text AS count, COALESCE(SUM(amount),0)::text AS sum FROM income ${where}`,
      values
    );
    const rowsRes = await query(
      `SELECT * FROM income ${where} ORDER BY received_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset]
    );
    return { rows: rowsRes.rows, total: Number(totalRes.rows[0].count), sum: Number(totalRes.rows[0].sum) };
  },

  async listExpenses(params: { from?: string; to?: string; category?: string; limit: number; offset: number }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (params.from) { conditions.push(`spent_at >= $${idx++}`); values.push(params.from); }
    if (params.to) { conditions.push(`spent_at < $${idx++}`); values.push(params.to); }
    if (params.category) { conditions.push(`category = $${idx++}`); values.push(params.category); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const totalRes = await query<{ count: string; sum: string }>(
      `SELECT COUNT(*)::text AS count, COALESCE(SUM(amount),0)::text AS sum FROM expenses ${where}`,
      values
    );
    const rowsRes = await query(
      `SELECT * FROM expenses ${where} ORDER BY spent_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset]
    );
    return { rows: rowsRes.rows, total: Number(totalRes.rows[0].count), sum: Number(totalRes.rows[0].sum) };
  },

  async incomeBetween(from: string, to: string): Promise<number> {
    const res = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount),0)::text AS total FROM income WHERE received_at >= $1 AND received_at < $2`,
      [from, to]
    );
    return Number(res.rows[0].total);
  },

  async expensesBetween(from: string, to: string): Promise<number> {
    const res = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount),0)::text AS total FROM expenses WHERE spent_at >= $1 AND spent_at < $2`,
      [from, to]
    );
    return Number(res.rows[0].total);
  },
};
