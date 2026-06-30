import { query } from '../../db/pool';
import { Role } from '../../auth/rbac';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  phone: string | null;
  commission_rate: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PublicUser = Omit<UserRow, 'password_hash'>;

const PUBLIC_COLUMNS =
  'id, email, full_name, role, phone, commission_rate, is_active, last_login_at, created_at, updated_at';

export const usersRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const res = await query<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    return res.rows[0] ?? null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const res = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  },

  async findPublicById(id: string): Promise<PublicUser | null> {
    const res = await query<PublicUser>(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return res.rows[0] ?? null;
  },

  async list(filters: { role?: Role; activeOnly?: boolean } = {}): Promise<PublicUser[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (filters.role) {
      conditions.push(`role = $${idx++}`);
      values.push(filters.role);
    }
    if (filters.activeOnly) {
      conditions.push('is_active = true');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query<PublicUser>(
      `SELECT ${PUBLIC_COLUMNS} FROM users ${where} ORDER BY created_at DESC`,
      values
    );
    return res.rows;
  },

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: Role;
    phone?: string | null;
    commissionRate?: number;
  }): Promise<PublicUser> {
    const res = await query<PublicUser>(
      `INSERT INTO users (email, password_hash, full_name, role, phone, commission_rate)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING ${PUBLIC_COLUMNS}`,
      [data.email, data.passwordHash, data.fullName, data.role, data.phone ?? null, data.commissionRate ?? 0]
    );
    return res.rows[0];
  },

  async update(
    id: string,
    data: Partial<{ fullName: string; role: Role; phone: string | null; commissionRate: number; isActive: boolean }>
  ): Promise<PublicUser | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.fullName !== undefined) { sets.push(`full_name = $${idx++}`); values.push(data.fullName); }
    if (data.role !== undefined) { sets.push(`role = $${idx++}`); values.push(data.role); }
    if (data.phone !== undefined) { sets.push(`phone = $${idx++}`); values.push(data.phone); }
    if (data.commissionRate !== undefined) { sets.push(`commission_rate = $${idx++}`); values.push(data.commissionRate); }
    if (data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); values.push(data.isActive); }
    if (!sets.length) return this.findPublicById(id);
    values.push(id);
    const res = await query<PublicUser>(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${PUBLIC_COLUMNS}`,
      values
    );
    return res.rows[0] ?? null;
  },

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  },

  async touchLogin(id: string): Promise<void> {
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
  },
};
