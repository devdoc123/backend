import { query } from '../../db/pool';
import { cache, CacheKeys } from '../../cache/cache';
import { today } from '../../utils/dates';

const TTL = 60;

export const reportsService = {
  /** Daily cash report: collections by method + income + expenses + net for a date. */
  async dailyCash(date: string) {
    return cache.remember(`${CacheKeys.reports}daily:${date}`, TTL, async () => {
      const [byMethod, incomeByCat, expenses, totals] = await Promise.all([
        query(`SELECT method AS label, COALESCE(SUM(amount),0)::float AS value, COUNT(*)::int AS count
                FROM payments WHERE paid_at::date = $1 GROUP BY method ORDER BY value DESC`, [date]),
        query(`SELECT category AS label, COALESCE(SUM(amount),0)::float AS value
                FROM income WHERE received_at::date = $1 GROUP BY category ORDER BY value DESC`, [date]),
        query(`SELECT category AS label, COALESCE(SUM(amount),0)::float AS value
                FROM expenses WHERE spent_at::date = $1 GROUP BY category ORDER BY value DESC`, [date]),
        query(`SELECT
                 (SELECT COALESCE(SUM(amount),0) FROM payments WHERE paid_at::date = $1)::float AS collected,
                 (SELECT COALESCE(SUM(amount),0) FROM income WHERE received_at::date = $1)::float AS income,
                 (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE spent_at::date = $1)::float AS expenses`, [date]),
      ]);
      const t = totals.rows[0];
      return {
        date,
        collectionsByMethod: byMethod.rows,
        incomeByCategory: incomeByCat.rows,
        expensesByCategory: expenses.rows,
        totals: { ...t, net: Number((t.income - t.expenses).toFixed(2)) },
      };
    });
  },

  /** Monthly revenue for a given year: income & expenses & profit per month. */
  async monthlyRevenue(year: number) {
    return cache.remember(`${CacheKeys.reports}monthly:${year}`, TTL, async () => {
      const res = await query(
        `WITH months AS (
           SELECT generate_series(1,12) AS m
         )
         SELECT months.m AS month,
           COALESCE((SELECT SUM(amount) FROM income WHERE EXTRACT(YEAR FROM received_at)=$1 AND EXTRACT(MONTH FROM received_at)=months.m),0)::float AS income,
           COALESCE((SELECT SUM(amount) FROM expenses WHERE EXTRACT(YEAR FROM spent_at)=$1 AND EXTRACT(MONTH FROM spent_at)=months.m),0)::float AS expenses
         FROM months ORDER BY months.m`,
        [year]
      );
      const rows = res.rows.map((r: any) => ({ ...r, profit: Number((r.income - r.expenses).toFixed(2)) }));
      return { year, months: rows };
    });
  },

  /** Profit & loss statement for a date range. */
  async profitAndLoss(from: string, to: string) {
    return cache.remember(`${CacheKeys.reports}pnl:${from}:${to}`, TTL, async () => {
      const [income, expenses] = await Promise.all([
        query(`SELECT category AS label, COALESCE(SUM(amount),0)::float AS value
                FROM income WHERE received_at::date BETWEEN $1 AND $2 GROUP BY category ORDER BY value DESC`, [from, to]),
        query(`SELECT category AS label, COALESCE(SUM(amount),0)::float AS value
                FROM expenses WHERE spent_at::date BETWEEN $1 AND $2 GROUP BY category ORDER BY value DESC`, [from, to]),
      ]);
      const totalIncome = income.rows.reduce((s: number, r: any) => s + r.value, 0);
      const totalExpenses = expenses.rows.reduce((s: number, r: any) => s + r.value, 0);
      return {
        from, to,
        income: income.rows, expenses: expenses.rows,
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        netProfit: Number((totalIncome - totalExpenses).toFixed(2)),
      };
    });
  },

  /** Expense report broken down by category for a range. */
  async expenseReport(from: string, to: string) {
    return cache.remember(`${CacheKeys.reports}exp:${from}:${to}`, TTL, async () => {
      const res = await query(
        `SELECT category AS label, COALESCE(SUM(amount),0)::float AS value, COUNT(*)::int AS count
         FROM expenses WHERE spent_at::date BETWEEN $1 AND $2 GROUP BY category ORDER BY value DESC`,
        [from, to]
      );
      const total = res.rows.reduce((s: number, r: any) => s + r.value, 0);
      return { from, to, categories: res.rows, total: Number(total.toFixed(2)) };
    });
  },

  /** Payment collection trend (daily) for a range. */
  async collectionTrend(from: string, to: string) {
    return cache.remember(`${CacheKeys.reports}collect:${from}:${to}`, TTL, async () => {
      const res = await query(
        `SELECT paid_at::date::text AS label, COALESCE(SUM(amount),0)::float AS value, COUNT(*)::int AS count
         FROM payments WHERE paid_at::date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
        [from, to]
      );
      return { from, to, points: res.rows };
    });
  },

  /** Revenue generated per trainer (membership + PT income attributed to trainer). */
  async trainerRevenue(from: string, to: string) {
    return cache.remember(`${CacheKeys.reports}trainer:${from}:${to}`, TTL, async () => {
      const res = await query(
        `SELECT u.id AS trainer_id, u.full_name AS trainer_name, u.commission_rate::float AS commission_rate,
                COALESCE(SUM(i.amount),0)::float AS revenue,
                ROUND(COALESCE(SUM(i.amount),0) * u.commission_rate / 100, 2)::float AS commission,
                COUNT(DISTINCT i.member_id)::int AS members
         FROM users u
         LEFT JOIN income i ON i.trainer_id = u.id AND i.received_at::date BETWEEN $1 AND $2
         WHERE u.role = 'trainer'
         GROUP BY u.id ORDER BY revenue DESC`,
        [from, to]
      );
      return { from, to, trainers: res.rows };
    });
  },

  /** Best selling membership plans by count and revenue. */
  async planPerformance(from: string, to: string) {
    return cache.remember(`${CacheKeys.reports}plans:${from}:${to}`, TTL, async () => {
      const res = await query(
        `SELECT plan_name AS label, COUNT(*)::int AS sold, COALESCE(SUM(total_amount),0)::float AS revenue
         FROM memberships WHERE created_at::date BETWEEN $1 AND $2 AND status <> 'cancelled'
         GROUP BY plan_name ORDER BY sold DESC, revenue DESC`,
        [from, to]
      );
      return { from, to, plans: res.rows };
    });
  },

  /** Membership growth: new members per month + highest-growth month. */
  async membershipGrowth(year: number) {
    return cache.remember(`${CacheKeys.reports}growth:${year}`, TTL, async () => {
      const res = await query(
        `SELECT EXTRACT(MONTH FROM joining_date)::int AS month, COUNT(*)::int AS new_members
         FROM members WHERE EXTRACT(YEAR FROM joining_date) = $1
         GROUP BY 1 ORDER BY 1`,
        [year]
      );
      const best = [...res.rows].sort((a: any, b: any) => b.new_members - a.new_members)[0] ?? null;
      return { year, months: res.rows, highestGrowthMonth: best };
    });
  },

  /** Members who stopped coming (active membership, no recent attendance). */
  async stoppedComing(days: number, limit: number) {
    const res = await query(
      `SELECT m.id, m.full_name, m.member_code, m.phone, MAX(a.attend_date)::text AS last_attendance
       FROM members m
       JOIN memberships ms ON ms.member_id = m.id AND ms.status <> 'cancelled'
         AND CURRENT_DATE <= ms.end_date + (ms.grace_period_days || ' days')::interval
       LEFT JOIN attendance a ON a.member_id = m.id
       GROUP BY m.id
       HAVING MAX(a.attend_date) IS NULL OR MAX(a.attend_date) < CURRENT_DATE - ($1 || ' days')::interval
       ORDER BY last_attendance ASC NULLS FIRST
       LIMIT $2`,
      [days, limit]
    );
    return { days, members: res.rows };
  },

  /** Operational snapshot answering owner's key questions in one call. */
  async ownerSnapshot() {
    const t = today();
    const [growth, trainers, plans] = await Promise.all([
      this.membershipGrowth(new Date().getUTCFullYear()),
      this.trainerRevenue(`${t.slice(0, 4)}-01-01`, t),
      this.planPerformance(`${t.slice(0, 4)}-01-01`, t),
    ]);
    return {
      bestPlan: plans.plans[0] ?? null,
      topTrainer: trainers.trainers[0] ?? null,
      highestGrowthMonth: growth.highestGrowthMonth,
    };
  },
};
