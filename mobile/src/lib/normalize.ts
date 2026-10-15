import { num } from "./money";
import { emptyAccounts, emptyPlan, emptySpending, type AccountsDoc, type Frequency, type Payday, type Plan, type Purchase, type SpendingDoc } from "../types";

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normalizeAccounts(d: unknown): AccountsDoc {
  if (!d || typeof d !== "object") return emptyAccounts();
  const o = d as Record<string, unknown>;
  return { accounts: arr(o.accounts), debts: arr(o.debts) };
}

const FREQUENCIES: Frequency[] = ["weekly", "biweekly", "semimonthly", "monthly"];

export function normalizePlan(d: unknown): Plan {
  if (!d || typeof d !== "object") return emptyPlan();
  const o = d as Record<string, unknown>;
  return {
    frequency: FREQUENCIES.includes(o.frequency as Frequency) ? (o.frequency as Frequency) : "biweekly",
    categories: arr(o.categories),
    goals: arr<Plan["goals"][number]>(o.goals).map((g) => ({ ...g, target: num(g.target), saved: num(g.saved), date: g.date || "", accountId: g.accountId || "" })),
    extraTo: typeof o.extraTo === "string" ? o.extraTo : "",
    ...(typeof o.nextPayday === "string" && o.nextPayday ? { nextPayday: o.nextPayday } : {}),
    paydays: arr<Payday>(o.paydays)
      .filter((p) => p && typeof p.date === "number")
      .map((p) => ({
        ...p,
        pay: num(p.pay),
        spend: num(p.spend),
        saved: num(p.saved),
        moves: arr(p.moves),
        limits: Array.isArray(p.limits) ? p.limits.map((l) => ({ ...l, limit: num(l.limit) })) : undefined,
        goals: Array.isArray(p.goals) ? p.goals.map((g) => ({ ...g, amount: num(g.amount) })) : undefined,
      })),
  };
}

export function normalizeSpending(d: unknown): SpendingDoc {
  if (!d || typeof d !== "object") return emptySpending();
  const o = d as Record<string, unknown>;
  return { purchases: arr<Purchase>(o.purchases).filter((p) => p && typeof p.at === "number").map((p) => ({ ...p, amount: num(p.amount), note: p.note || "" })) };
}
