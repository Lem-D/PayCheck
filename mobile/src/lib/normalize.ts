import { num } from "./money";
import { emptyAccounts, emptyPlan, emptySpending, type AccountsDoc, type Frequency, type Plan, type Purchase, type SpendingDoc } from "../types";

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
    paydays: arr(o.paydays),
  };
}

export function normalizeSpending(d: unknown): SpendingDoc {
  if (!d || typeof d !== "object") return emptySpending();
  const o = d as Record<string, unknown>;
  return { purchases: arr<Purchase>(o.purchases).filter((p) => p && typeof p.at === "number").map((p) => ({ ...p, amount: num(p.amount), note: p.note || "" })) };
}
