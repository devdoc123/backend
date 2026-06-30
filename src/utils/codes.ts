import { PoolClient } from 'pg';
import { query } from '../db/pool';

async function nextCounter(name: string, client?: PoolClient): Promise<number> {
  const runner = client ? client.query.bind(client) : query;
  const res = await runner('SELECT next_counter($1) AS value', [name]);
  return Number(res.rows[0].value);
}

const pad = (n: number, len: number) => String(n).padStart(len, '0');

/** e.g. M-000123 */
export async function nextMemberCode(client?: PoolClient): Promise<string> {
  const n = await nextCounter('member_code', client);
  return `M-${pad(n, 6)}`;
}

/** e.g. INV-20260630-000045 */
export async function nextInvoiceNumber(client?: PoolClient): Promise<string> {
  const n = await nextCounter('invoice_number', client);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${today}-${pad(n, 6)}`;
}

/** e.g. RCPT-20260630-000045 */
export async function nextReceiptNumber(client?: PoolClient): Promise<string> {
  const n = await nextCounter('receipt_number', client);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RCPT-${today}-${pad(n, 6)}`;
}
