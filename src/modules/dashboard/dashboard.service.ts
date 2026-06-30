import { query } from '../../db/pool';
import { cache, CacheKeys } from '../../cache/cache';

interface Card {
  activeMembers: number;
  expiredMembers: number;
  totalMembers: number;
  newMembersThisMonth: number;
  revenueToday: number;
  revenueThisMonth: number;
  expensesThisMonth: number;
  profitThisMonth: number;
  attendanceToday: number;
  outstandingDues: number;
  dueThisWeek: number;
}

async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  const res = await query<{ v: string }>(sql, params);
  return Number(res.rows[0]?.v ?? 0);
}

export const dashboardService = {
  async summary(): Promise<Card> {
    return cache.remember<Card>(`${CacheKeys.dashboard}summary`, 30, async () => {
      const [
        activeMembers, expiredMembers, totalMembers, newMembersThisMonth,
        revenueToday, revenueThisMonth, expensesThisMonth, attendanceToday,
        outstandingDues, dueThisWeek,
      ] = await Promise.all([
        scalar(`SELECT COUNT(DISTINCT m.id)::text AS v
                FROM members m JOIN memberships ms ON ms.member_id = m.id
                WHERE ms.status <> 'cancelled'
                  AND CURRENT_DATE <= ms.end_date + (ms.grace_period_days || ' days')::interval`),
        scalar(`SELECT COUNT(*)::text AS v FROM members m
                WHERE NOT EXISTS (
                  SELECT 1 FROM memberships ms WHERE ms.member_id = m.id AND ms.status <> 'cancelled'
                    AND CURRENT_DATE <= ms.end_date + (ms.grace_period_days || ' days')::interval
                )
                AND EXISTS (SELECT 1 FROM memberships ms2 WHERE ms2.member_id = m.id)`),
        scalar(`SELECT COUNT(*)::text AS v FROM members`),
        scalar(`SELECT COUNT(*)::text AS v FROM members WHERE date_trunc('month', joining_date) = date_trunc('month', CURRENT_DATE)`),
        scalar(`SELECT COALESCE(SUM(amount),0)::text AS v FROM payments WHERE paid_at::date = CURRENT_DATE`),
        scalar(`SELECT COALESCE(SUM(amount),0)::text AS v FROM income WHERE date_trunc('month', received_at) = date_trunc('month', CURRENT_DATE)`),
        scalar(`SELECT COALESCE(SUM(amount),0)::text AS v FROM expenses WHERE date_trunc('month', spent_at) = date_trunc('month', CURRENT_DATE)`),
        scalar(`SELECT COUNT(*)::text AS v FROM attendance WHERE attend_date = CURRENT_DATE`),
        scalar(`SELECT COALESCE(SUM(balance),0)::text AS v FROM invoices WHERE status IN ('unpaid','partial')`),
        scalar(`SELECT COUNT(*)::text AS v FROM invoices WHERE status IN ('unpaid','partial') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`),
      ]);

      return {
        activeMembers, expiredMembers, totalMembers, newMembersThisMonth,
        revenueToday, revenueThisMonth, expensesThisMonth,
        profitThisMonth: Math.round((revenueThisMonth - expensesThisMonth) * 100) / 100,
        attendanceToday, outstandingDues, dueThisWeek,
      };
    });
  },

  async charts() {
    return cache.remember(`${CacheKeys.dashboard}charts`, 60, async () => {
      const [revenueTrend, attendanceTrend, membershipGrowth, expenseDistribution] = await Promise.all([
        query(`SELECT to_char(date_trunc('month', received_at),'YYYY-MM') AS label, COALESCE(SUM(amount),0)::float AS value
                FROM income WHERE received_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
                GROUP BY 1 ORDER BY 1`),
        query(`SELECT attend_date::text AS label, COUNT(*)::int AS value
                FROM attendance WHERE attend_date >= CURRENT_DATE - INTERVAL '29 days'
                GROUP BY 1 ORDER BY 1`),
        query(`SELECT to_char(date_trunc('month', joining_date),'YYYY-MM') AS label, COUNT(*)::int AS value
                FROM members WHERE joining_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
                GROUP BY 1 ORDER BY 1`),
        query(`SELECT category AS label, COALESCE(SUM(amount),0)::float AS value
                FROM expenses WHERE date_trunc('month', spent_at) = date_trunc('month', CURRENT_DATE)
                GROUP BY 1 ORDER BY 2 DESC`),
      ]);
      return {
        revenueTrend: revenueTrend.rows,
        attendanceTrend: attendanceTrend.rows,
        membershipGrowth: membershipGrowth.rows,
        expenseDistribution: expenseDistribution.rows,
      };
    });
  },
};
