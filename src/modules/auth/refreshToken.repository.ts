import { query } from '../../db/pool';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  jti: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  replaced_by: string | null;
}

export const refreshTokenRepository = {
  async store(data: {
    userId: string;
    jti: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    await query(
      `INSERT INTO refresh_tokens (user_id, jti, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [data.userId, data.jti, data.tokenHash, data.expiresAt, data.userAgent ?? null, data.ipAddress ?? null]
    );
  },

  async findByJti(jti: string): Promise<RefreshTokenRow | null> {
    const res = await query<RefreshTokenRow>('SELECT * FROM refresh_tokens WHERE jti = $1', [jti]);
    return res.rows[0] ?? null;
  },

  async revoke(jti: string, replacedBy?: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE jti = $1 AND revoked_at IS NULL`,
      [jti, replacedBy ?? null]
    );
  },

  /** Revoke every active refresh token for a user (used on reuse detection / logout-all). */
  async revokeAllForUser(userId: string): Promise<void> {
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
      userId,
    ]);
  },
};
