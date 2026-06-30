import { query } from '../../db/pool';
import { logger } from '../../config/logger';

export interface AuditEntryInput {
  actorId: string | null;
  actorName?: string | null;
  action: string; // e.g. "member.create"
  entityType: string; // e.g. "member"
  entityId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export const auditService = {
  /** Write an audit entry. Never throws — auditing must not break business flows. */
  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, description, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.actorId,
          entry.actorName ?? null,
          entry.action,
          entry.entityType,
          entry.entityId ?? null,
          entry.description ?? null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.ipAddress ?? null,
        ]
      );
    } catch (err) {
      logger.error({ err, entry }, 'Failed to write audit log');
    }
  },

  async list(params: {
    limit: number;
    offset: number;
    entityType?: string;
    actorId?: string;
    action?: string;
  }): Promise<{ rows: any[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.entityType) {
      conditions.push(`entity_type = $${idx++}`);
      values.push(params.entityType);
    }
    if (params.actorId) {
      conditions.push(`actor_id = $${idx++}`);
      values.push(params.actorId);
    }
    if (params.action) {
      conditions.push(`action ILIKE $${idx++}`);
      values.push(`%${params.action}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_logs ${where}`,
      values
    );
    const rowsRes = await query(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset]
    );

    return { rows: rowsRes.rows, total: Number(totalRes.rows[0].count) };
  },
};
