import { PoolClient } from 'pg';
import { query } from '../../db/pool';
import { nextMemberCode } from '../../utils/codes';

export interface MemberRow {
  id: string;
  member_code: string;
  full_name: string;
  father_name: string | null;
  phone: string;
  emergency_contact: string | null;
  gender: string | null;
  date_of_birth: string | null;
  joining_date: string;
  height_cm: string | null;
  weight_kg: string | null;
  goal: string | null;
  medical_notes: string | null;
  status: string;
  notes: string | null;
  trainer_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * SELECT fragment that augments members with their current membership and
 * a derived ACTIVE/EXPIRED flag based on end_date + grace period.
 */
const MEMBER_WITH_MEMBERSHIP = `
  SELECT
    m.*,
    t.full_name AS trainer_name,
    cm.id              AS membership_id,
    cm.plan_name       AS plan_name,
    cm.start_date      AS membership_start,
    cm.end_date        AS membership_end,
    cm.grace_period_days AS grace_period_days,
    CASE
      WHEN cm.id IS NULL THEN 'none'
      WHEN CURRENT_DATE <= cm.end_date THEN 'active'
      WHEN CURRENT_DATE <= cm.end_date + (cm.grace_period_days || ' days')::interval THEN 'grace'
      ELSE 'expired'
    END AS membership_state
  FROM members m
  LEFT JOIN users t ON t.id = m.trainer_id
  LEFT JOIN LATERAL (
    SELECT * FROM memberships ms
    WHERE ms.member_id = m.id AND ms.status <> 'cancelled'
    ORDER BY ms.end_date DESC, ms.created_at DESC
    LIMIT 1
  ) cm ON true
`;

export interface MemberListFilters {
  search?: string;
  status?: string; // member.status
  membershipState?: 'active' | 'expired' | 'grace' | 'none';
  trainerId?: string;
  limit: number;
  offset: number;
}

export const membersRepository = {
  async list(filters: MemberListFilters): Promise<{ rows: any[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      conditions.push(`(lower(m.full_name) LIKE lower($${idx}) OR m.phone LIKE $${idx} OR lower(m.member_code) LIKE lower($${idx}))`);
      values.push(`%${filters.search}%`);
      idx++;
    }
    if (filters.status) {
      conditions.push(`m.status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.trainerId) {
      conditions.push(`m.trainer_id = $${idx++}`);
      values.push(filters.trainerId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // membership state filter is applied on the derived column via outer query
    const stateFilter = filters.membershipState
      ? `WHERE membership_state = $${idx++}`
      : '';
    if (filters.membershipState) values.push(filters.membershipState);

    const base = `${MEMBER_WITH_MEMBERSHIP} ${where}`;

    const totalRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM (${base}) sub ${stateFilter}`,
      values
    );

    const rowsRes = await query(
      `SELECT * FROM (${base}) sub ${stateFilter} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, filters.limit, filters.offset]
    );

    return { rows: rowsRes.rows, total: Number(totalRes.rows[0].count) };
  },

  async findById(id: string): Promise<any | null> {
    const res = await query(`${MEMBER_WITH_MEMBERSHIP} WHERE m.id = $1`, [id]);
    return res.rows[0] ?? null;
  },

  /** Lightweight, indexed search used by attendance & global search. */
  async search(term: string, limit = 10): Promise<any[]> {
    const res = await query(
      `${MEMBER_WITH_MEMBERSHIP}
       WHERE lower(m.full_name) LIKE lower($1) OR m.phone LIKE $1 OR lower(m.member_code) LIKE lower($1)
       ORDER BY (lower(m.full_name) LIKE lower($2)) DESC, m.full_name ASC
       LIMIT $3`,
      [`%${term}%`, `${term}%`, limit]
    );
    return res.rows;
  },

  async create(data: {
    fullName: string;
    fatherName?: string | null;
    phone: string;
    emergencyContact?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    joiningDate?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    goal?: string | null;
    medicalNotes?: string | null;
    notes?: string | null;
    trainerId?: string | null;
    createdBy: string;
  }, client?: PoolClient): Promise<MemberRow> {
    const runner = client ? client.query.bind(client) : query;
    const code = await nextMemberCode(client);
    const res = await runner(
      `INSERT INTO members
        (member_code, full_name, father_name, phone, emergency_contact, gender, date_of_birth,
         joining_date, height_cm, weight_kg, goal, medical_notes, notes, trainer_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, CURRENT_DATE), $9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        code, data.fullName, data.fatherName ?? null, data.phone, data.emergencyContact ?? null,
        data.gender ?? null, data.dateOfBirth ?? null, data.joiningDate ?? null,
        data.heightCm ?? null, data.weightKg ?? null, data.goal ?? null, data.medicalNotes ?? null,
        data.notes ?? null, data.trainerId ?? null, data.createdBy,
      ]
    );
    return res.rows[0] as MemberRow;
  },

  async update(id: string, data: Record<string, unknown>): Promise<MemberRow | null> {
    const map: Record<string, string> = {
      fullName: 'full_name',
      fatherName: 'father_name',
      phone: 'phone',
      emergencyContact: 'emergency_contact',
      gender: 'gender',
      dateOfBirth: 'date_of_birth',
      joiningDate: 'joining_date',
      heightCm: 'height_cm',
      weightKg: 'weight_kg',
      goal: 'goal',
      medicalNotes: 'medical_notes',
      status: 'status',
      notes: 'notes',
      trainerId: 'trainer_id',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push(data[key]);
      }
    }
    if (!sets.length) {
      const r = await query<MemberRow>('SELECT * FROM members WHERE id = $1', [id]);
      return r.rows[0] ?? null;
    }
    values.push(id);
    const res = await query<MemberRow>(
      `UPDATE members SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.rows[0] ?? null;
  },

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM members WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  },

  async findByTrainer(trainerId: string): Promise<any[]> {
    const res = await query(`${MEMBER_WITH_MEMBERSHIP} WHERE m.trainer_id = $1 ORDER BY m.full_name`, [
      trainerId,
    ]);
    return res.rows;
  },
};
