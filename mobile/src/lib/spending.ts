import { cents, total } from "./money";
import { PERIOD_DAYS, type Category, type Plan, type Purchase } from "../types";

const DAY = 86_400_000;

/** Purchases kept on the phone. Old ones beyond this are dropped. */
export const MAX_PURCHASES = 2000;

export type Level = "ok" | "warn" | "over";

export interface Period {
  /** When this pay period started: the last logged payday, or null when none has been logged yet. */
  start: number | null;
  /** The expected next payday, or null when no payday has been logged yet. */
  next: number | null;
  daysLeft: number | null;
}

/**
 * The current pay period runs from the most recent logged payday until one pay frequency later.
 * Logging a new payday on the Payday tab starts a new period.
 */
export function currentPeriod(plan: Plan, now = Date.now()): Period {
  const last = plan.paydays.length ? Math.max(...plan.paydays.map((p) => p.date)) : null;
  if (last === null) return { start: null, next: null, daysLeft: null };
  const next = last + PERIOD_DAYS[plan.frequency] * DAY;
  return { start: last, next, daysLeft: Math.max(0, Math.ceil((next - now) / DAY)) };
}

export const inPeriod = (purchases: Purchase[], period: Period) =>
  period.start === null ? purchases : purchases.filter((p) => p.at >= (period.start as number));

export interface CategoryStatus {
  category: Category;
  spent: number;
  left: number;
  /** Share of the limit used, 0 to 1 or more. */
  used: number;
  level: Level;
}

/** Normal under 75% of the limit used, a warning from 75%, over at 100% or more. */
export function levelFor(spent: number, limit: number): Level {
  if (limit <= 0) return spent > 0 ? "over" : "ok";
  const used = spent / limit;
  if (used >= 1) return "over";
  if (used >= 0.75) return "warn";
  return "ok";
}

export function categoryStatus(plan: Plan, purchases: Purchase[], period: Period): CategoryStatus[] {
  const current = inPeriod(purchases, period);
  return plan.categories.map((category) => {
    const spent = cents(total(current.filter((p) => p.categoryId === category.id), (p) => p.amount));
    const limit = cents(category.limit);
    return { category, spent, left: cents(limit - spent), used: limit > 0 ? spent / limit : spent > 0 ? 1 : 0, level: levelFor(spent, limit) };
  });
}

export interface PeriodTotals {
  limit: number;
  spent: number;
  left: number;
  /** Spending logged against categories that no longer exist. */
  other: number;
  level: Level;
}

export function periodTotals(plan: Plan, purchases: Purchase[], period: Period): PeriodTotals {
  const ids = new Set(plan.categories.map((c) => c.id));
  const current = inPeriod(purchases, period);
  const limit = cents(total(plan.categories, (c) => c.limit));
  const spent = cents(total(current, (p) => p.amount));
  const other = cents(total(current.filter((p) => !ids.has(p.categoryId)), (p) => p.amount));
  return { limit, spent, left: cents(limit - spent), other, level: levelFor(spent, limit) };
}

/** Newest first, capped so storage stays small. */
export function addPurchase(purchases: Purchase[], p: Purchase): Purchase[] {
  return [p, ...purchases].sort((a, b) => b.at - a.at).slice(0, MAX_PURCHASES);
}
