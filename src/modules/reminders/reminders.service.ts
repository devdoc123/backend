import { query } from '../../db/pool';
import { settingsRepository } from '../settings/settings.repository';
import { buildWhatsAppLink } from '../../utils/phone';
import { today, daysBetween } from '../../utils/dates';
import { NotFound } from '../../utils/errors';

function renderTemplate(
  template: string,
  vars: { name: string; amount: string; due_date: string; status: string; currency: string; gym: string }
): string {
  return template
    .replace(/\{name\}/g, vars.name)
    .replace(/\{amount\}/g, vars.amount)
    .replace(/\{due_date\}/g, vars.due_date)
    .replace(/\{status\}/g, vars.status)
    .replace(/\{currency\}/g, vars.currency)
    .replace(/\{gym\}/g, vars.gym);
}

function reminderTypeFor(offsetDays: number): string {
  // offsetDays = due_date - today (positive => upcoming, negative => overdue)
  if (offsetDays > 0) return `due_-${offsetDays}`;
  if (offsetDays === 0) return 'due_0';
  return `due_${Math.abs(offsetDays)}`;
}

export const remindersService = {
  /**
   * List payment reminders that are due according to the configured offsets
   * (default: 3 days before, on due date, 3 & 7 days after). Each item includes
   * a ready-to-click wa.me link.
   */
  async pending() {
    const settings = await settingsRepository.get();
    const offsets: number[] = settings.reminder_offsets ?? [-3, 0, 3, 7];
    const t = today();

    const res = await query(
      `SELECT i.id AS invoice_id, i.invoice_number, i.balance, i.total_amount, i.due_date::text AS due_date, i.status,
              m.id AS member_id, m.full_name, m.phone, m.member_code
       FROM invoices i JOIN members m ON m.id = i.member_id
       WHERE i.status IN ('unpaid','partial') AND i.balance > 0`
    );

    const items = res.rows
      .map((row: any) => {
        // dueOffset = days from today to due date (due - today)
        const dueOffset = daysBetween(t, row.due_date);
        // reminder applies when (due_date - today) matches one of the offsets.
        // offsets are stored as days relative to due date: -3 => 3 days before due (today is 3 before),
        // i.e. due - today = 3.  We therefore match dueOffset against -offset.
        const matched = offsets.some((o) => -o === dueOffset);
        return { row, dueOffset, matched };
      })
      .filter((x) => x.matched)
      .map(({ row, dueOffset }) => {
        const status = dueOffset > 0 ? 'pending' : dueOffset === 0 ? 'due today' : 'overdue';
        const message = renderTemplate(settings.reminder_template, {
          name: row.full_name,
          amount: Number(row.balance).toLocaleString(),
          due_date: row.due_date,
          status,
          currency: settings.currency,
          gym: settings.gym_name,
        });
        return {
          invoiceId: row.invoice_id,
          invoiceNumber: row.invoice_number,
          memberId: row.member_id,
          memberName: row.full_name,
          memberCode: row.member_code,
          phone: row.phone,
          balance: Number(row.balance),
          dueDate: row.due_date,
          dueOffset,
          reminderType: reminderTypeFor(dueOffset),
          status,
          message,
          whatsappLink: buildWhatsAppLink(row.phone, message),
        };
      })
      .sort((a, b) => a.dueOffset - b.dueOffset);

    return items;
  },

  /** Generate a wa.me link for a single invoice on demand. */
  async forInvoice(invoiceId: string) {
    const settings = await settingsRepository.get();
    const res = await query(
      `SELECT i.invoice_number, i.balance, i.due_date::text AS due_date, i.status,
              m.id AS member_id, m.full_name, m.phone
       FROM invoices i JOIN members m ON m.id = i.member_id WHERE i.id = $1`,
      [invoiceId]
    );
    const row = res.rows[0];
    if (!row) throw NotFound('Invoice not found');
    const dueOffset = daysBetween(today(), row.due_date);
    const status = dueOffset > 0 ? 'pending' : dueOffset === 0 ? 'due today' : 'overdue';
    const message = renderTemplate(settings.reminder_template, {
      name: row.full_name,
      amount: Number(row.balance).toLocaleString(),
      due_date: row.due_date,
      status,
      currency: settings.currency,
      gym: settings.gym_name,
    });
    return {
      invoiceId,
      memberId: row.member_id,
      memberName: row.full_name,
      phone: row.phone,
      message,
      whatsappLink: buildWhatsAppLink(row.phone, message),
    };
  },

  /** Log that a reminder was dispatched (staff clicked the wa.me link). */
  async logSent(data: { invoiceId?: string; memberId: string; reminderType: string; message: string; sentBy: string }) {
    await query(
      `INSERT INTO reminder_logs (invoice_id, member_id, reminder_type, message, sent_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [data.invoiceId ?? null, data.memberId, data.reminderType, data.message, data.sentBy]
    );
  },
};
