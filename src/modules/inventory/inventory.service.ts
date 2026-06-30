import { withTransaction } from '../../db/pool';
import { inventoryRepository } from './inventory.repository';
import { accountingRepository } from '../accounting/accounting.repository';
import { BadRequest, NotFound } from '../../utils/errors';
import { cache, CacheKeys } from '../../cache/cache';
import { realtimeBus } from '../../realtime/events';
import { auditService } from '../audit/audit.service';

interface Actor { id: string; name: string; ip?: string | null }

function money(n: number) { return Math.round(n * 100) / 100; }

export const inventoryService = {
  async list(activeOnly: boolean) { return inventoryRepository.list(activeOnly); },
  async lowStock() { return inventoryRepository.lowStock(); },

  async detail(id: string) {
    const item = await inventoryRepository.findById(id);
    if (!item) throw NotFound('Inventory item not found');
    const transactions = await inventoryRepository.transactionsForItem(id);
    return { item, transactions };
  },

  async create(input: any, actor: Actor) {
    const item = await inventoryRepository.create(input);
    await auditService.record({ actorId: actor.id, actorName: actor.name, action: 'inventory.create', entityType: 'inventory_item', entityId: item.id, description: `Created item ${item.name}` });
    realtimeBus.emitEvent('inventory.updated', { id: item.id });
    return item;
  },

  async update(id: string, input: any, actor: Actor) {
    const existing = await inventoryRepository.findById(id);
    if (!existing) throw NotFound('Inventory item not found');
    const item = await inventoryRepository.update(id, input);
    await auditService.record({ actorId: actor.id, actorName: actor.name, action: 'inventory.update', entityType: 'inventory_item', entityId: id, metadata: input });
    realtimeBus.emitEvent('inventory.updated', { id });
    return item;
  },

  /** Restock: increase quantity and log a purchase transaction. */
  async purchase(id: string, input: { quantity: number; unitPrice?: number; note?: string }, actor: Actor) {
    const result = await withTransaction(async (client) => {
      const item = await inventoryRepository.findById(id, client);
      if (!item) throw NotFound('Inventory item not found');
      const unitPrice = input.unitPrice ?? Number(item.cost_price);
      const total = money(unitPrice * input.quantity);
      const updated = await inventoryRepository.adjustQuantity(client, id, input.quantity);
      const txn = await inventoryRepository.recordTransaction(client, {
        itemId: id, type: 'purchase', quantity: input.quantity, unitPrice, total, note: input.note, createdBy: actor.id,
      });
      return { item: updated, txn };
    });
    realtimeBus.emitEvent('inventory.updated', { id });
    await auditService.record({ actorId: actor.id, actorName: actor.name, action: 'inventory.purchase', entityType: 'inventory_item', entityId: id, metadata: { quantity: input.quantity } });
    return result;
  },

  /** Sell: decrease quantity, log a sale, and record supplement income. */
  async sell(id: string, input: { quantity: number; unitPrice?: number; memberId?: string | null; note?: string }, actor: Actor) {
    const result = await withTransaction(async (client) => {
      const item = await inventoryRepository.findById(id, client);
      if (!item) throw NotFound('Inventory item not found');
      if (item.quantity < input.quantity) throw BadRequest(`Insufficient stock. Available: ${item.quantity}`);
      const unitPrice = input.unitPrice ?? Number(item.unit_price);
      const total = money(unitPrice * input.quantity);
      const updated = await inventoryRepository.adjustQuantity(client, id, -input.quantity);
      const income = await accountingRepository.createIncome(
        {
          category: 'supplement', amount: total, memberId: input.memberId ?? null,
          source: item.name, description: `Sold ${input.quantity} x ${item.name}`, recordedBy: actor.id,
        },
        client
      );
      const txn = await inventoryRepository.recordTransaction(client, {
        itemId: id, type: 'sale', quantity: input.quantity, unitPrice, total,
        memberId: input.memberId ?? null, incomeId: income.id, note: input.note, createdBy: actor.id,
      });
      return { item: updated, txn, income };
    });
    await Promise.all([cache.invalidatePrefix(CacheKeys.dashboard), cache.invalidatePrefix(CacheKeys.reports), cache.invalidatePrefix(CacheKeys.stats)]);
    realtimeBus.emitEvent('inventory.updated', { id });
    realtimeBus.emitEvent('income.recorded', { amount: Number(result.income.amount), category: 'supplement' });
    await auditService.record({ actorId: actor.id, actorName: actor.name, action: 'inventory.sale', entityType: 'inventory_item', entityId: id, metadata: { quantity: input.quantity } });
    return result;
  },
};
