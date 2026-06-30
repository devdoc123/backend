import { attendanceRepository } from './attendance.repository';
import { membersRepository } from '../members/members.repository';
import { BadRequest, NotFound } from '../../utils/errors';
import { cache, CacheKeys } from '../../cache/cache';
import { realtimeBus } from '../../realtime/events';
import { auditService } from '../audit/audit.service';

interface Actor {
  id: string;
  name: string;
  ip?: string | null;
}

export const attendanceService = {
  async mark(memberId: string, actor: Actor, allowExpired = false) {
    const member = await membersRepository.findById(memberId);
    if (!member) throw NotFound('Member not found');

    const state = member.membership_state as string;
    if (!allowExpired && (state === 'expired' || state === 'none')) {
      throw BadRequest('Membership is expired. Renew before marking attendance.', {
        membershipState: state,
        memberId,
      });
    }

    const { row, duplicate } = await attendanceRepository.mark(memberId, actor.id);
    if (!duplicate) {
      await Promise.all([
        cache.invalidatePrefix(CacheKeys.dashboard),
        cache.invalidatePrefix(CacheKeys.stats),
      ]);
      await auditService.record({
        actorId: actor.id,
        actorName: actor.name,
        action: 'attendance.mark',
        entityType: 'attendance',
        entityId: row.id,
        description: `Marked attendance for ${member.full_name}`,
        ipAddress: actor.ip,
      });
      realtimeBus.emitEvent('attendance.marked', {
        memberId,
        name: member.full_name,
        at: row.check_in_at,
      });
    }
    return { attendance: row, duplicate, member: { id: member.id, name: member.full_name, state } };
  },

  async listForDate(date: string, limit: number, offset: number) {
    return attendanceRepository.listForDate(date, limit, offset);
  },

  async memberHistory(memberId: string, limit = 60) {
    return attendanceRepository.listForMember(memberId, limit);
  },

  async inactiveMembers(sinceDate: string, limit = 50) {
    return attendanceRepository.inactiveMembers(sinceDate, limit);
  },
};
