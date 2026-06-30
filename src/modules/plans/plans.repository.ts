import { query } from '../../db/pool';

export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  price: string;
  registration_fee: string;
  grace_period_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const plansRepository = {
  async list(activeOnly = false): Promise<PlanRow[]> {
    const where = activeOnly ? 'WHERE is_active = true' : '';
    const res = await query<PlanRow>(`SELECT * FROM membership_plans ${where} ORDER BY price ASC`);
    return res.rows;
  },

  async findById(id: string): Promise<PlanRow | null> {
    const res = await query<PlanRow>('SELECT * FROM membership_plans WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  },

  async create(data: {
    name: string;
    description?: string | null;
    durationDays: number;
    price: number;
    registrationFee: number;
    gracePeriodDays: number;
  }): Promise<PlanRow> {
    const res = await query<PlanRow>(
      `INSERT INTO membership_plans (name, description, duration_days, price, registration_fee, grace_period_days)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.name, data.description ?? null, data.durationDays, data.price, data.registrationFee, data.gracePeriodDays]
    );
    return res.rows[0];
  },

  async update(id: string, data: Record<string, unknown>): Promise<PlanRow | null> {
    const map: Record<string, string> = {
      name: 'name',
      description: 'description',
      durationDays: 'duration_days',
      price: 'price',
      registrationFee: 'registration_fee',
      gracePeriodDays: 'grace_period_days',
      isActive: 'is_active',
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
    if (!sets.length) return this.findById(id);
    values.push(id);
    const res = await query<PlanRow>(
      `UPDATE membership_plans SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.rows[0] ?? null;
  },
};
