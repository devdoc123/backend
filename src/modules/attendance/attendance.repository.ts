import { query } from '../../db/pool';

export const attendanceRepository = {
  async mark(memberId: string, markedBy: string): Promise<{ row: any; duplicate: boolean }> {
    const res = await query(
      `INSERT INTO attendance (member_id, marked_by)
       VALUES ($1, $2)
       ON CONFLICT (member_id, attend_date) DO NOTHING
       RETURNING *`,
      [memberId, markedBy]
    );
    if (res.rows[0]) return { row: res.rows[0], duplicate: false };
    const existing = await query(
      'SELECT * FROM attendance WHERE member_id = $1 AND attend_date = CURRENT_DATE',
      [memberId]
    );
    return { row: existing.rows[0], duplicate: true };
  },

  async listForDate(date: string, limit: number, offset: number): Promise<{ rows: any[]; total: number }> {
    const totalRes = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM attendance WHERE attend_date = $1',
      [date]
    );
    const rowsRes = await query(
      `SELECT a.*, m.full_name, m.member_code, m.phone
       FROM attendance a JOIN members m ON m.id = a.member_id
       WHERE a.attend_date = $1
       ORDER BY a.check_in_at DESC
       LIMIT $2 OFFSET $3`,
      [date, limit, offset]
    );
    return { rows: rowsRes.rows, total: Number(totalRes.rows[0].count) };
  },

  async listForMember(memberId: string, limit: number): Promise<any[]> {
    const res = await query(
      'SELECT * FROM attendance WHERE member_id = $1 ORDER BY attend_date DESC LIMIT $2',
      [memberId, limit]
    );
    return res.rows;
  },

  async countForDate(date: string): Promise<number> {
    const res = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM attendance WHERE attend_date = $1',
      [date]
    );
    return Number(res.rows[0].count);
  },

  async countBetween(from: string, to: string): Promise<number> {
    const res = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM attendance WHERE attend_date >= $1 AND attend_date <= $2',
      [from, to]
    );
    return Number(res.rows[0].count);
  },

  /** Daily attendance counts for a date range (for trend charts). */
  async dailyTrend(from: string, to: string): Promise<{ date: string; count: number }[]> {
    const res = await query<{ date: string; count: string }>(
      `SELECT attend_date::text AS date, COUNT(*)::text AS count
       FROM attendance WHERE attend_date >= $1 AND attend_date <= $2
       GROUP BY attend_date ORDER BY attend_date`,
      [from, to]
    );
    return res.rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  },

  /** Peak hours histogram (0-23) over a date range. */
  async peakHours(from: string, to: string): Promise<{ hour: number; count: number }[]> {
    const res = await query<{ hour: string; count: string }>(
      `SELECT EXTRACT(HOUR FROM check_in_at)::int::text AS hour, COUNT(*)::text AS count
       FROM attendance WHERE attend_date >= $1 AND attend_date <= $2
       GROUP BY 1 ORDER BY 1`,
      [from, to]
    );
    return res.rows.map((r) => ({ hour: Number(r.hour), count: Number(r.count) }));
  },

  /** Members with an active membership who have not attended since `sinceDate`. */
  async inactiveMembers(sinceDate: string, limit: number): Promise<any[]> {
    const res = await query(
      `SELECT m.id, m.full_name, m.member_code, m.phone,
              MAX(a.attend_date)::text AS last_attendance
       FROM members m
       LEFT JOIN attendance a ON a.member_id = m.id
       WHERE m.status = 'active'
       GROUP BY m.id
       HAVING MAX(a.attend_date) IS NULL OR MAX(a.attend_date) < $1
       ORDER BY last_attendance ASC NULLS FIRST
       LIMIT $2`,
      [sinceDate, limit]
    );
    return res.rows;
  },
};
