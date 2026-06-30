import { withTransaction } from '../../db/pool';
import { membershipsRepository } from './memberships.repository';
import { invoicesRepository } from './invoices.repository';
import { paymentsRepository } from './payments.repository';
import { plansRepository } from '../plans/plans.repository';
import { membersRepository } from '../members/members.repository';
import { accountingRepository } from '../accounting/accounting.repository';
import { nextInvoiceNumber, nextReceiptNumber } from '../../utils/codes';
import { addDays, today } from '../../utils/dates';
import { BadRequest, NotFound } from '../../utils/errors';
import { cache, CacheKeys } from '../../cache/cache';
import { realtimeBus } from '../../realtime/events';
import { auditService } from '../audit/audit.service';

interface Actor {
  id: string;
  name: string;
  ip?: string | null;
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export const billingService = {
  /**
   * Create a new membership for a member, generate its invoice, and optionally
   * record an initial (partial or full) payment — all atomically.
   */
  async createMembership(
    input: {
      memberId: string;
      planId: string;
      startDate?: string;
      discount?: number;
      priceOverride?: number;
      includeRegistration?: boolean;
      dueDate?: string;
      trainerId?: string | null;
      notes?: string;
      initialPayment?: { amount: number; method: string; reference?: string; note?: string };
    },
    actor: Actor
  ) {
    const member = await membersRepository.findById(input.memberId);
    if (!member) throw NotFound('Member not found');
    const plan = await plansRepository.findById(input.planId);
    if (!plan) throw NotFound('Membership plan not found');
    if (!plan.is_active) throw BadRequest('Membership plan is inactive');

    const startDate = input.startDate ?? today();
    const endDate = addDays(startDate, plan.duration_days);
    const price = input.priceOverride ?? Number(plan.price);
    const registrationFee = input.includeRegistration === false ? 0 : Number(plan.registration_fee);
    const discount = input.discount ?? 0;
    const totalAmount = money(price + registrationFee - discount);
    if (totalAmount < 0) throw BadRequest('Discount cannot exceed the total amount');

    const initial = input.initialPayment;
    if (initial && initial.amount > totalAmount) {
      throw BadRequest('Initial payment cannot exceed the invoice total');
    }

    const result = await withTransaction(async (client) => {
      const membership = await membershipsRepository.create(client, {
        memberId: input.memberId,
        planId: plan.id,
        planName: plan.name,
        startDate,
        endDate,
        gracePeriodDays: plan.grace_period_days,
        price,
        registrationFee,
        discount,
        totalAmount,
        trainerId: input.trainerId ?? member.trainer_id ?? null,
        createdBy: actor.id,
      });

      const invoiceNumber = await nextInvoiceNumber(client);
      let invoice = await invoicesRepository.create(client, {
        invoiceNumber,
        memberId: input.memberId,
        membershipId: membership.id,
        totalAmount,
        dueDate: input.dueDate ?? startDate,
        notes: input.notes ?? null,
        createdBy: actor.id,
      });

      let payment = null;
      if (initial && initial.amount > 0) {
        const receiptNumber = await nextReceiptNumber(client);
        payment = await paymentsRepository.create(client, {
          receiptNumber,
          invoiceId: invoice.id,
          memberId: input.memberId,
          amount: money(initial.amount),
          method: initial.method,
          reference: initial.reference ?? null,
          note: initial.note ?? null,
          recordedBy: actor.id,
        });
        invoice = await invoicesRepository.recalculate(client, invoice.id);
        await accountingRepository.createIncome(
          {
            category: 'membership',
            amount: money(initial.amount),
            memberId: input.memberId,
            trainerId: membership.trainer_id,
            paymentId: payment.id,
            description: `Payment for invoice ${invoice.invoice_number}`,
            recordedBy: actor.id,
          },
          client
        );
      }

      // ensure member marked active
      await client.query(`UPDATE members SET status = 'active' WHERE id = $1`, [input.memberId]);

      return { membership, invoice, payment };
    });

    await this.invalidate();
    await auditService.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'membership.create',
      entityType: 'membership',
      entityId: result.membership.id,
      description: `Created ${plan.name} membership for ${member.full_name}`,
      metadata: { invoice: result.invoice.invoice_number, total: totalAmount },
      ipAddress: actor.ip,
    });
    realtimeBus.emitEvent('membership.created', { memberId: input.memberId, membershipId: result.membership.id });
    if (result.payment) {
      realtimeBus.emitEvent('payment.recorded', { amount: result.payment.amount, memberId: input.memberId });
    }
    return result;
  },

  /** Renew: a new membership period starting after the current one ends. */
  async renewMembership(
    memberId: string,
    input: {
      planId: string;
      discount?: number;
      priceOverride?: number;
      dueDate?: string;
      initialPayment?: { amount: number; method: string; reference?: string; note?: string };
    },
    actor: Actor
  ) {
    const latest = await membershipsRepository.latestForMember(memberId);
    // start the day after current end if still valid, otherwise today
    let startDate = today();
    if (latest && latest.end_date >= today()) {
      startDate = addDays(latest.end_date, 1);
    }
    return this.createMembership(
      {
        memberId,
        planId: input.planId,
        startDate,
        discount: input.discount,
        priceOverride: input.priceOverride,
        includeRegistration: false, // no joining fee on renewals
        dueDate: input.dueDate,
        initialPayment: input.initialPayment,
      },
      actor
    );
  },

  /** Record a payment against an existing invoice (supports partials/installments). */
  async recordPayment(
    invoiceId: string,
    input: { amount: number; method: string; reference?: string; note?: string; paidAt?: string },
    actor: Actor
  ) {
    const result = await withTransaction(async (client) => {
      const invoice = await invoicesRepository.findById(invoiceId, client);
      if (!invoice) throw NotFound('Invoice not found');
      if (invoice.status === 'void') throw BadRequest('Cannot pay a void invoice');
      const balance = Number(invoice.balance);
      if (balance <= 0) throw BadRequest('Invoice is already fully paid');
      const amount = money(input.amount);
      if (amount <= 0) throw BadRequest('Payment amount must be positive');
      if (amount > balance + 0.001) throw BadRequest(`Payment exceeds outstanding balance (${balance})`);

      const membership = invoice.membership_id
        ? await membershipsRepository.latestForMember(invoice.member_id, client)
        : null;

      const receiptNumber = await nextReceiptNumber(client);
      const payment = await paymentsRepository.create(client, {
        receiptNumber,
        invoiceId: invoice.id,
        memberId: invoice.member_id,
        amount,
        method: input.method,
        reference: input.reference ?? null,
        note: input.note ?? null,
        paidAt: input.paidAt ?? null,
        recordedBy: actor.id,
      });
      const updated = await invoicesRepository.recalculate(client, invoice.id);
      await accountingRepository.createIncome(
        {
          category: 'membership',
          amount,
          memberId: invoice.member_id,
          trainerId: membership?.trainer_id ?? null,
          paymentId: payment.id,
          description: `Payment for invoice ${invoice.invoice_number}`,
          receivedAt: input.paidAt ?? null,
          recordedBy: actor.id,
        },
        client
      );
      return { payment, invoice: updated };
    });

    await this.invalidate();
    await auditService.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'payment.record',
      entityType: 'payment',
      entityId: result.payment.id,
      description: `Recorded payment ${result.payment.receipt_number} of ${result.payment.amount}`,
      metadata: { invoiceId, method: input.method },
      ipAddress: actor.ip,
    });
    realtimeBus.emitEvent('payment.recorded', { amount: result.payment.amount, memberId: result.invoice.member_id });
    return result;
  },

  async memberLedger(memberId: string) {
    const member = await membersRepository.findById(memberId);
    if (!member) throw NotFound('Member not found');
    const [memberships, invoices, payments] = await Promise.all([
      membershipsRepository.listForMember(memberId),
      invoicesRepository.listForMember(memberId),
      paymentsRepository.listForMember(memberId),
    ]);
    const outstanding = invoices
      .filter((i) => i.status === 'unpaid' || i.status === 'partial')
      .reduce((sum, i) => sum + Number(i.balance), 0);
    return { member, memberships, invoices, payments, outstanding: money(outstanding) };
  },

  async getInvoice(invoiceId: string) {
    const invoice = await invoicesRepository.findById(invoiceId);
    if (!invoice) throw NotFound('Invoice not found');
    const payments = await paymentsRepository.listForInvoice(invoiceId);
    return { invoice, payments };
  },

  async getReceipt(paymentId: string) {
    const payment = await paymentsRepository.findById(paymentId);
    if (!payment) throw NotFound('Payment not found');
    const invoice = await invoicesRepository.findById(payment.invoice_id);
    const member = await membersRepository.findById(payment.member_id);
    return { payment, invoice, member };
  },

  async listDues(params: { dueBefore?: string; limit: number; offset: number }) {
    return invoicesRepository.listDues(params);
  },

  async invalidate() {
    await Promise.all([
      cache.invalidatePrefix(CacheKeys.dashboard),
      cache.invalidatePrefix(CacheKeys.reports),
      cache.invalidatePrefix(CacheKeys.stats),
      cache.invalidatePrefix(CacheKeys.members),
    ]);
  },
};
