import { cents, num, total } from "./money";
import { PERIOD_DAYS, type AccountsDoc, type Account, type Goal, type Move, type Plan } from "../types";

const DAY = 86_400_000;

export const remaining = (g: Goal) => Math.max(0, cents(num(g.target) - num(g.saved)));

/** Paydays until the goal's date (at least 1), or null when the goal has no date. */
export function paydaysLeft(g: Goal, plan: Plan, now = Date.now()): number | null {
  if (!g.date) return null;
  const days = (new Date(`${g.date}T23:59:59`).getTime() - now) / DAY;
  return Math.max(1, Math.ceil(days / PERIOD_DAYS[plan.frequency]));
}

/** What a dated goal needs from each paycheque to land on time, rounded up to the cent. */
export function perPaycheque(g: Goal, plan: Plan, now = Date.now()): number | null {
  const left = paydaysLeft(g, plan, now);
  if (left === null) return null;
  return Math.min(remaining(g), Math.ceil((remaining(g) / left) * 100) / 100);
}

/** Formats a "YYYY-MM-DD" goal date, read at noon so time zones can't shift the day. */
export const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

export const accountName = (accounts: Account[], id: string) => accounts.find((a) => a.id === id)?.name || "chequing";

export interface SpendLine {
  name: string;
  amount: number;
  /** How far this category fell short of its limit. */
  short: number;
}

export interface GoalShare {
  goal: Goal;
  need: number;
  amount: number;
}

export interface Extra {
  goal?: Goal;
  accountId: string;
  label: string;
  amount: number;
}

export interface Allocation {
  pay: number;
  spend: SpendLine[];
  spendTotal: number;
  shortSpend: number;
  goals: GoalShare[];
  /** Dated goals needed more than was left, so each got a share. */
  short: boolean;
  totalNeed: number;
  extra: Extra | null;
  saveTotal: number;
  unassigned: number;
  transfers: Move[];
}

/** Spending limits first, then dated goals (scaled down together when the cheque is short), then the leftover. */
export function allocate(payIn: number, plan: Plan, accounts: Account[], now = Date.now()): Allocation {
  const pay = cents(payIn);
  let left = pay;

  const spend = plan.categories.map((c) => {
    const want = cents(c.limit);
    const amount = Math.min(left, want);
    left = cents(left - amount);
    return { name: c.name || "Unnamed", amount, short: cents(want - amount) };
  });

  const dated = plan.goals.filter((g) => remaining(g) > 0 && g.date).map((goal) => ({ goal, need: perPaycheque(goal, plan, now) ?? 0 }));
  const totalNeed = cents(total(dated, (x) => x.need));
  const factor = totalNeed > left && totalNeed > 0 ? left / totalNeed : 1;
  const goals = dated.map((x) => ({ ...x, amount: Math.floor(x.need * factor * 100) / 100 }));
  left = cents(left - total(goals, (x) => x.amount));
  if (factor < 1 && goals.length) {
    // Rounding cents go to the first goal so nothing is left behind.
    goals[0].amount = cents(goals[0].amount + left);
    left = 0;
  }

  let extra: Extra | null = null;
  if (left > 0 && plan.extraTo) {
    const [kind, id] = plan.extraTo.split(":");
    if (kind === "goal") {
      const g = plan.goals.find((x) => x.id === id);
      if (g) {
        const already = goals.find((x) => x.goal === g)?.amount ?? 0;
        const amount = Math.min(left, Math.max(0, cents(remaining(g) - already)));
        if (amount > 0) {
          extra = { goal: g, accountId: g.accountId, label: g.name, amount };
          left = cents(left - amount);
        }
      }
    } else if (accounts.some((a) => a.id === id)) {
      extra = { accountId: id, label: accountName(accounts, id), amount: left };
      left = 0;
    }
  }

  const byAccount = new Map<string, number>();
  const add = (id: string, amt: number) => {
    if (amt > 0) byAccount.set(id || "", cents((byAccount.get(id || "") ?? 0) + amt));
  };
  goals.forEach((x) => add(x.goal.accountId, x.amount));
  if (extra) add(extra.accountId, extra.amount);

  return {
    pay,
    spend,
    spendTotal: cents(total(spend, (x) => x.amount)),
    shortSpend: cents(total(spend, (x) => x.short)),
    goals,
    short: factor < 1,
    totalNeed,
    extra,
    saveTotal: cents(total(goals, (x) => x.amount) + (extra?.amount ?? 0)),
    unassigned: left,
    transfers: [...byAccount].map(([accountId, amount]) => ({ accountId, name: accountName(accounts, accountId), amount })),
  };
}

/** Record a payday. When `apply` is set, transfers are added to balances and goal progress. */
export function logPayday(payIn: number, plan: Plan, acc: AccountsDoc, apply: boolean, now = Date.now()): { plan: Plan; acc: AccountsDoc; result: Allocation } {
  const r = allocate(payIn, plan, acc.accounts, now);
  let goals = plan.goals;
  let accounts = acc.accounts;
  if (apply) {
    const add = new Map<string, number>();
    for (const x of r.goals) add.set(x.goal.id, (add.get(x.goal.id) ?? 0) + x.amount);
    if (r.extra?.goal) add.set(r.extra.goal.id, (add.get(r.extra.goal.id) ?? 0) + r.extra.amount);
    goals = goals.map((g) => (add.has(g.id) ? { ...g, saved: cents(num(g.saved) + (add.get(g.id) ?? 0)) } : g));
    accounts = accounts.map((a) => {
      const t = r.transfers.find((x) => x.accountId === a.id);
      return t ? { ...a, balance: cents(num(a.balance) + t.amount), updated: now } : a;
    });
  }
  const paydays = [...plan.paydays, { date: now, pay: r.pay, spend: r.spendTotal, saved: r.saveTotal, moves: r.transfers, applied: apply }].slice(-60);
  return { plan: { ...plan, goals, paydays }, acc: { ...acc, accounts }, result: r };
}
