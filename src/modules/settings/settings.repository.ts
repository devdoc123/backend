import { query } from '../../db/pool';

export interface SettingsRow {
  id: boolean;
  gym_name: string;
  address: string | null;
  phone: string | null;
  currency: string;
  default_grace_period_days: number;
  reminder_offsets: number[];
  reminder_template: string;
  updated_at: string;
}

export const settingsRepository = {
  async get(): Promise<SettingsRow> {
    const res = await query<SettingsRow>('SELECT * FROM settings WHERE id = true');
    if (res.rows[0]) return res.rows[0];
    // ensure a singleton exists
    const inserted = await query<SettingsRow>(
      `INSERT INTO settings (id) VALUES (true) ON CONFLICT (id) DO UPDATE SET gym_name = settings.gym_name RETURNING *`
    );
    return inserted.rows[0];
  },

  async update(data: Record<string, unknown>): Promise<SettingsRow> {
    const map: Record<string, string> = {
      gymName: 'gym_name',
      address: 'address',
      phone: 'phone',
      currency: 'currency',
      defaultGracePeriodDays: 'default_grace_period_days',
      reminderOffsets: 'reminder_offsets',
      reminderTemplate: 'reminder_template',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push(key === 'reminderOffsets' ? JSON.stringify(data[key]) : data[key]);
      }
    }
    if (!sets.length) return this.get();
    const res = await query<SettingsRow>(
      `UPDATE settings SET ${sets.join(', ')} WHERE id = true RETURNING *`,
      values
    );
    return res.rows[0];
  },
};
