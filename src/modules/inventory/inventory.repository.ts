import { PoolClient } from 'pg';
import { query } from '../../db/pool';

export interface InventoryItemRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  unit_price: string;
  cost_price: string;
  reorder_level: number;
  is_active: boolean;
}

export const inventoryRepository = {
  async list(activeOnly = false): Promise<InventoryItemRow[]> {
    const where = activeOnly ? 'WHERE is_active = true' : '';
    const res = await query<InventoryItemRow>(`SELECT * FROM inventory_items ${where} ORDER BY name ASC`);
    return res.rows;
  },

  async findById(id: string, client?: PoolClient): Promise<InventoryItemRow | null> {
    const runner = client ? client.query.bind(client) : query;
    const res = await runner('SELECT * FROM inventory_items WHERE id = $1', [id]);
    return (res.rows[0] as InventoryItemRow) ?? null;
  },

  async create(data: {
    name: string; sku?: string | null; category?: string | null;
    quantity: number; unitPrice: number; costPrice: number; reorderLevel: number;
  }): Promise<InventoryItemRow> {
    const res = await query<InventoryItemRow>(
      `INSERT INTO inventory_items (name, sku, category, quantity, unit_price, cost_price, reorder_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.name, data.sku ?? null, data.category ?? null, data.quantity, data.unitPrice, data.costPrice, data.reorderLevel]
    );
    return res.rows[0];
  },

  async update(id: string, data: Record<string, unknown>): Promise<InventoryItemRow | null> {
    const map: Record<string, string> = {
      name: 'name', sku: 'sku', category: 'category', unitPrice: 'unit_price',
      costPrice: 'cost_price', reorderLevel: 'reorder_level', isActive: 'is_active',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) { sets.push(`${col} = $${idx++}`); values.push(data[key]); }
    }
    if (!sets.length) return this.findById(id);
    values.push(id);
    const res = await query<InventoryItemRow>(
      `UPDATE inventory_items SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.rows[0] ?? null;
  },

  async adjustQuantity(client: PoolClient, id: string, delta: number): Promise<InventoryItemRow> {
    const res = await client.query<InventoryItemRow>(
      'UPDATE inventory_items SET quantity = quantity + $2 WHERE id = $1 RETURNING *',
      [id, delta]
    );
    return res.rows[0];
  },

  async recordTransaction(
    client: PoolClient,
    data: {
      itemId: string; type: string; quantity: number; unitPrice: number; total: number;
      memberId?: string | null; incomeId?: string | null; note?: string | null; createdBy: string;
    }
  ): Promise<any> {
    const res = await client.query(
      `INSERT INTO inventory_transactions (item_id, type, quantity, unit_price, total, member_id, income_id, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.itemId, data.type, data.quantity, data.unitPrice, data.total, data.memberId ?? null, data.incomeId ?? null, data.note ?? null, data.createdBy]
    );
    return res.rows[0];
  },

  async transactionsForItem(itemId: string, limit = 50): Promise<any[]> {
    const res = await query(
      'SELECT * FROM inventory_transactions WHERE item_id = $1 ORDER BY created_at DESC LIMIT $2',
      [itemId, limit]
    );
    return res.rows;
  },

  async lowStock(): Promise<InventoryItemRow[]> {
    const res = await query<InventoryItemRow>(
      'SELECT * FROM inventory_items WHERE is_active = true AND quantity <= reorder_level ORDER BY quantity ASC'
    );
    return res.rows;
  },
};
