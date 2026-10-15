import { perPaycheque, remaining } from "./allocate";
import { cents, num, total } from "./money";
import { PERIOD_DAYS, type Goal, type Plan, type Purchase } from "../types";

const DAY = 86_400_000;

export interface LimitResult {
  id: string;
  name: string;
  limit: number;
  spent: number;
  /** Spent no more than the limit. */
  kept: boolean;
  over: number;
}

export interface PeriodRecord {
  start: number;
  /** When the next payday was logged, or now for the period still running. */
  end: number;
  open: boolean;
  pay: number;
  saved: number;
  /** Share of the paycheque saved, 0 to 1. */
  rate: number;
  limits: LimitResult[];
  kept: number;
  spent: number;
  limitTotal: number;
  /** Spending in categories that weren't limits that period. */
  other: number;
  /** The payday was logged before limits were recorded, so today's limits stand in. */
  todaysLimits: boolean;
}

/**
 * One record per pay period, newest first. A period runs from one logged payday to the next;
 * the latest one is still open and runs until now.
 */
export function periods(plan: Plan, purchases: Purchase[], now = Date.now()): PeriodRecord[] {
  const days = [...plan.paydays].sort((a, b) => a.date - b.date);
  return days
    .map((p, i) => {
      const open = i === days.length - 1;
      const end = open ? Math.max(now, p.date) : days[i + 1].date;
      const bought = purchases.filter((x) => x.at >= p.date && x.at < end + (open ? 1 : 0));
      const todaysLimits = !p.limits;
      const lims = p.limits ?? plan.categories.map((c) => ({ id: c.id, name: c.name || "Unnamed", limit: cents(c.limit) }));
      const limits = lims.map((l) => {
        const spent = cents(total(bought.filter((x) => x.categoryId === l.id), (x) => x.amount));
        const over = cents(spent - l.limit);
        return { id: l.id, name: l.name, limit: l.limit, spent, kept: over <= 0, over: Math.max(0, over) };
      });
      const ids = new Set(lims.map((l) => l.id));
      return {
        start: p.date,
        end,
        open,
        pay: num(p.pay),
        saved: num(p.saved),
        rate: num(p.pay) > 0 ? num(p.saved) / num(p.pay) : 0,
        limits,
        kept: limits.filter((l) => l.kept).length,
        spent: cents(total(bought, (x) => x.amount)),
        limitTotal: cents(total(lims, (l) => l.limit)),
        other: cents(total(bought.filter((x) => !ids.has(x.categoryId)), (x) => x.amount)),
        todaysLimits,
      };
    })
    .reverse();
}

export interface CategoryHabit {
  id: string;
  name: string;
  kept: number;
  of: number;
  /** Kept or not in each finished period it appeared in, oldest first, latest 8. */
  marks: boolean[];
}

export interface HabitSummary {
  /** Finished pay periods counted. */
  periods: number;
  saved: number;
  avgSaved: number;
  avgRate: number;
  kept: number;
  limits: number;
  /** Finished periods in a row, counting back from the latest, where every limit was kept. */
  streak: number;
  categories: CategoryHabit[];
}

/** Totals over finished pay periods; the one still running doesn't count yet. */
export function summarize(records: PeriodRecord[]): HabitSummary {
  const closed = records.filter((r) => !r.open);
  const saved = cents(total(closed, (r) => r.saved));
  let streak = 0;
  for (const r of closed) {
    if (r.limits.length && r.kept === r.limits.length) streak++;
    else break;
  }
  const byId = new Map<string, CategoryHabit>();
  for (const r of [...closed].reverse()) {
    for (const l of r.limits) {
      const h = byId.get(l.id) ?? { id: l.id, name: l.name, kept: 0, of: 0, marks: [] };
      h.name = l.name;
      h.of++;
      if (l.kept) h.kept++;
      h.marks = [...h.marks, l.kept].slice(-8);
      byId.set(l.id, h);
    }
  }
  return {
    periods: closed.length,
    saved,
    avgSaved: closed.length ? cents(saved / closed.length) : 0,
    avgRate: closed.length ? total(closed, (r) => r.rate) / closed.length : 0,
    kept: total(closed, (r) => r.kept),
    limits: total(closed, (r) => r.limits.length),
    streak,
    categories: [...byId.values()],
  };
}

export type GoalStatus = "reached" | "on-track" | "behind" | "new" | "no-date";

export interface GoalTrack {
  goal: Goal;
  status: GoalStatus;
  /** What it needs per paycheque from now to land on its date. */
  need: number | null;
  /** What it got per payday on average, over the last three paydays that recorded it. */
  getting: number | null;
  /** When it would be reached at the current pace. */
  finish: number | null;
}

export function trackGoals(plan: Plan, now = Date.now()): GoalTrack[] {
  const recent = [...plan.paydays].filter((p) => p.goals).sort((a, b) => b.date - a.date).slice(0, 3);
  const period = PERIOD_DAYS[plan.frequency] * DAY;
  return plan.goals.map((goal) => {
    const left = remaining(goal);
    const need = perPaycheque(goal, plan, now);
    const getting = recent.length ? cents(total(recent, (p) => p.goals?.find((g) => g.id === goal.id)?.amount ?? 0) / recent.length) : null;
    const finish = left > 0 && getting ? now + Math.ceil(left / getting) * period : null;
    let status: GoalStatus;
    if (left <= 0) status = "reached";
    else if (getting === null) status = "new";
    else if (!goal.date) status = "no-date";
    else status = getting + 0.005 >= (need ?? 0) ? "on-track" : "behind";
    return { goal, status, need, getting, finish };
  });
}
