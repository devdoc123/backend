import { PoolClient } from 'pg';
import { query } from '../../db/pool';

export interface PaymentRow {
  id: string;
  receipt_number: string;
  invoice_id: string;
  member_id: string;
  amount: string;
  method: string;
  reference: string | null;
  note: string | null;
  paid_at: string;
  recorded_by: string | null;
  created_at: string;
}

export const paymentsRepository = {
  async create(
    client: PoolClient,
    data: {
      receiptNumber: string;
      invoiceId: string;
      memberId: string;
      amount: number;
      method: string;
      reference?: string | null;
      note?: string | null;
      paidAt?: string | null;
      recordedBy: string;
    }
  ): Promise<PaymentRow> {
    const res = await client.query<PaymentRow>(
      `INSERT INTO payments (receipt_number, invoice_id, member_id, amount, method, reference, note, paid_at, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, now()), $9)
       RETURNING *`,
      [
        data.receiptNumber, data.invoiceId, data.memberId, data.amount, data.method,
        data.reference ?? null, data.note ?? null, data.paidAt ?? null, data.recordedBy,
      ]
    );
    return res.rows[0];
  },

  async findById(id: string): Promise<PaymentRow | null> {
    const res = await query<PaymentRow>('SELECT * FROM payments WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  },

  async listForInvoice(invoiceId: string): Promise<PaymentRow[]> {
    const res = await query<PaymentRow>(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY paid_at ASC',
      [invoiceId]
    );
    return res.rows;
  },

  async listForMember(memberId: string): Promise<PaymentRow[]> {
    const res = await query<PaymentRow>(
      'SELECT * FROM payments WHERE member_id = $1 ORDER BY paid_at DESC',
      [memberId]
    );
    return res.rows;
  },

  async collectedBetween(from: string, to: string): Promise<number> {
    const res = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount),0)::text AS total FROM payments WHERE paid_at >= $1 AND paid_at < $2`,
      [from, to]
    );
    return Number(res.rows[0].total);
  },
};
