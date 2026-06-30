import { membersRepository, MemberListFilters } from './members.repository';
import { cache, CacheKeys } from '../../cache/cache';
import { normalizePhone } from '../../utils/phone';
import { NotFound } from '../../utils/errors';
import { realtimeBus } from '../../realtime/events';
import { auditService } from '../audit/audit.service';

interface Actor {
  id: string;
  name: string;
  ip?: string | null;
}

export const membersService = {
  async list(filters: MemberListFilters) {
    return membersRepository.list(filters);
  },

  async get(id: string) {
    const member = await membersRepository.findById(id);
    if (!member) throw NotFound('Member not found');
    return member;
  },

  async search(term: string, limit: number) {
    const key = `${CacheKeys.search}${term.toLowerCase()}:${limit}`;
    return cache.remember(key, 30, () => membersRepository.search(term, limit));
  },

  async create(input: any, actor: Actor) {
    const member = await membersRepository.create({
      ...input,
      phone: normalizePhone(input.phone),
      emergencyContact: input.emergencyContact ? normalizePhone(input.emergencyContact) : null,
      createdBy: actor.id,
    });
    await this.invalidate();
    await auditService.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'member.create',
      entityType: 'member',
      entityId: member.id,
      description: `Created member ${member.full_name} (${member.member_code})`,
      ipAddress: actor.ip,
    });
    realtimeBus.emitEvent('member.created', { id: member.id, name: member.full_name });
    return member;
  },

  async update(id: string, input: any, actor: Actor) {
    const existing = await membersRepository.findById(id);
    if (!existing) throw NotFound('Member not found');
    const patch = { ...input };
    if (patch.phone) patch.phone = normalizePhone(patch.phone);
    if (patch.emergencyContact) patch.emergencyContact = normalizePhone(patch.emergencyContact);
    const member = await membersRepository.update(id, patch);
    await this.invalidate();
    await auditService.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'member.update',
      entityType: 'member',
      entityId: id,
      metadata: input,
      ipAddress: actor.ip,
    });
    realtimeBus.emitEvent('member.updated', { id });
    return member;
  },

  async remove(id: string, actor: Actor) {
    const existing = await membersRepository.findById(id);
    if (!existing) throw NotFound('Member not found');
    await membersRepository.delete(id);
    await this.invalidate();
    await auditService.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'member.delete',
      entityType: 'member',
      entityId: id,
      description: `Deleted member ${existing.full_name} (${existing.member_code})`,
      ipAddress: actor.ip,
    });
  },

  async invalidate() {
    await Promise.all([
      cache.invalidatePrefix(CacheKeys.members),
      cache.invalidatePrefix(CacheKeys.search),
      cache.invalidatePrefix(CacheKeys.dashboard),
      cache.invalidatePrefix(CacheKeys.stats),
    ]);
  },
};
