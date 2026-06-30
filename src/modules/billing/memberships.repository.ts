import { PoolClient } from 'pg';
import { query } from '../../db/pool';

export interface MembershipRow {
  id: string;
  member_id: string;
  plan_id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  grace_period_days: number;
  price: string;
  registration_fee: string;
  discount: string;
  total_amount: string;
  status: string;
  trainer_id: string | null;
  created_by: string | null;
  created_at: string;
}

export const membershipsRepository = {
  async create(
    client: PoolClient,
    data: {
      memberId: string;
      planId: string;
      planName: string;
      startDate: string;
      endDate: string;
      gracePeriodDays: number;
      price: number;
      registrationFee: number;
      discount: number;
      totalAmount: number;
      trainerId?: string | null;
      createdBy: string;
    }
  ): Promise<MembershipRow> {
    const res = await client.query<MembershipRow>(
      `INSERT INTO memberships
        (member_id, plan_id, plan_name, start_date, end_date, grace_period_days,
         price, registration_fee, discount, total_amount, status, trainer_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         CASE WHEN $4 > CURRENT_DATE THEN 'upcoming'::membership_status ELSE 'active'::membership_status END,
         $11,$12)
       RETURNING *`,
      [
        data.memberId, data.planId, data.planName, data.startDate, data.endDate, data.gracePeriodDays,
        data.price, data.registrationFee, data.discount, data.totalAmount, data.trainerId ?? null, data.createdBy,
      ]
    );
    return res.rows[0];
  },

  async listForMember(memberId: string): Promise<MembershipRow[]> {
    const res = await query<MembershipRow>(
      'SELECT * FROM memberships WHERE member_id = $1 ORDER BY start_date DESC',
      [memberId]
    );
    return res.rows;
  },

  async latestForMember(memberId: string, client?: PoolClient): Promise<MembershipRow | null> {
    const runner = client ? client.query.bind(client) : query;
    const res = await runner(
      `SELECT * FROM memberships WHERE member_id = $1 AND status <> 'cancelled'
       ORDER BY end_date DESC, created_at DESC LIMIT 1`,
      [memberId]
    );
    return (res.rows[0] as MembershipRow) ?? null;
  },

  /** Mark memberships expired when end_date + grace has passed. Returns affected ids. */
  async expireOverdue(): Promise<string[]> {
    const res = await query<{ id: string }>(
      `UPDATE memberships
       SET status = 'expired'
       WHERE status IN ('active','upcoming')
         AND CURRENT_DATE > end_date + (grace_period_days || ' days')::interval
       RETURNING id`
    );
    return res.rows.map((r) => r.id);
  },

  /** Activate upcoming memberships whose start date has arrived. */
  async activateDue(): Promise<void> {
    await query(
      `UPDATE memberships SET status = 'active'
       WHERE status = 'upcoming' AND start_date <= CURRENT_DATE
         AND CURRENT_DATE <= end_date + (grace_period_days || ' days')::interval`
    );
  },
};
