import { describe, expect, it } from "@jest/globals";
import { allocate, logPayday, paydaysLeft, perPaycheque } from "./allocate";
import { emptyPlan, type AccountsDoc, type Goal, type Plan } from "../types";

// Noon on Oct 14, 2026; biweekly pay.
const NOW = new Date("2026-10-14T12:00:00").getTime();

const acc: AccountsDoc = {
  accounts: [
    { id: "chq", name: "Chequing", kind: "Chequing", balance: 500 },
    { id: "tfsa", name: "EQ TFSA", kind: "TFSA", balance: 1000 },
    { id: "sav", name: "Savings", kind: "Savings", balance: 200 },
  ],
  debts: [],
};

const goal = (over: Partial<Goal>): Goal => ({ id: "g", name: "Goal", accountId: "sav", target: 1000, saved: 0, date: "", ...over });

const plan = (over: Partial<Plan> = {}): Plan => ({
  ...emptyPlan(),
  categories: [
    { id: "a", name: "Rent", limit: 1000 },
    { id: "b", name: "Groceries", limit: 300 },
  ],
  ...over,
});

describe("goal math", () => {
  it("counts paydays left until the date", () => {
    // Dec 22 is 69.5 days away (counting to the end of the day), five two-week paydays.
    expect(paydaysLeft(goal({ date: "2026-12-22" }), plan(), NOW)).toBe(5);
    expect(perPaycheque(goal({ date: "2026-12-22", target: 1000 }), plan(), NOW)).toBe(200);
  });

  it("asks for at least one payday, and nothing for undated goals", () => {
    expect(paydaysLeft(goal({ date: "2026-10-14" }), plan(), NOW)).toBe(1);
    expect(perPaycheque(goal({}), plan(), NOW)).toBeNull();
  });

  it("rounds the per-paycheque amount up to the cent", () => {
    expect(perPaycheque(goal({ date: "2026-11-24", target: 100 }), plan(), NOW)).toBe(33.34);
  });
});

describe("allocate", () => {
  it("fills spending, then dated goals, then the leftover", () => {
    const p = plan({
      goals: [goal({ id: "trip", accountId: "sav", date: "2026-12-22", target: 1000 }), goal({ id: "tfsa", name: "Max TFSA", accountId: "tfsa", target: 7000 })],
      extraTo: "goal:tfsa",
    });
    const r = allocate(2000, p, acc.accounts, NOW);
    expect(r.spendTotal).toBe(1300);
    expect(r.goals.map((x) => [x.goal.id, x.amount])).toEqual([["trip", 200]]);
    expect(r.extra?.amount).toBe(500);
    expect(r.saveTotal).toBe(700);
    expect(r.unassigned).toBe(0);
    expect(r.transfers).toEqual([
      { accountId: "sav", name: "Savings", amount: 200 },
      { accountId: "tfsa", name: "EQ TFSA", amount: 500 },
    ]);
  });

  it("scales dated goals down together when the cheque is short", () => {
    const p = plan({
      goals: [goal({ id: "a", date: "2026-12-22", target: 1000 }), goal({ id: "b", accountId: "tfsa", date: "2026-12-22", target: 2000 })],
    });
    const r = allocate(1600, p, acc.accounts, NOW);
    expect(r.short).toBe(true);
    expect(r.totalNeed).toBe(600);
    expect(r.saveTotal).toBe(300);
    expect(r.goals.map((x) => x.amount)).toEqual([100, 200]);
    expect(r.unassigned).toBe(0);
  });

  it("matches the prototype's worked example", () => {
    // $2,100 pay, $1,610 limits, two dated goals that need $716.67 against $490 left.
    const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString().slice(0, 10);
    const p = plan({
      categories: [{ id: "a", name: "Everything", limit: 1610 }],
      goals: [
        goal({ id: "ef", target: 5000, saved: 1500, date: day(14 * 14 - 1) }),
        goal({ id: "tfsa", accountId: "tfsa", target: 7000, saved: 4200, date: day(6 * 14 - 1) }),
      ],
    });
    const r = allocate(2100, p, acc.accounts, NOW);
    expect(r.totalNeed).toBe(716.67);
    expect(r.goals.map((x) => x.amount)).toEqual([170.93, 319.07]);
    expect(r.unassigned).toBe(0);
  });

  it("gives goals nothing when spending isn't covered", () => {
    const r = allocate(1100, plan({ goals: [goal({ date: "2026-12-22" })] }), acc.accounts, NOW);
    expect(r.shortSpend).toBe(200);
    expect(r.spend[1]).toEqual({ name: "Groceries", amount: 100, short: 200 });
    expect(r.saveTotal).toBe(0);
  });

  it("caps leftover to a goal at what it still needs", () => {
    const r = allocate(2000, plan({ goals: [goal({ id: "g", target: 1000, saved: 900 })], extraTo: "goal:g" }), acc.accounts, NOW);
    expect(r.extra?.amount).toBe(100);
    expect(r.unassigned).toBe(600);
  });

  it("can send all leftover to an account", () => {
    const r = allocate(2000, plan({ extraTo: "acct:tfsa" }), acc.accounts, NOW);
    expect(r.transfers).toEqual([{ accountId: "tfsa", name: "EQ TFSA", amount: 700 }]);
  });

  it("keeps leftover in chequing when nowhere is picked", () => {
    expect(allocate(2000, plan(), acc.accounts, NOW).unassigned).toBe(700);
  });
});

describe("logPayday", () => {
  it("adds transfers to balances and goal progress when applied", () => {
    const p = plan({ goals: [goal({ id: "g", accountId: "tfsa", date: "2026-12-22", target: 1000 })], extraTo: "goal:g" });
    const next = logPayday(2000, p, acc, true, NOW);
    expect(next.plan.goals[0].saved).toBe(700);
    expect(next.acc.accounts.find((a) => a.id === "tfsa")?.balance).toBe(1700);
    expect(next.plan.paydays).toEqual([{ date: NOW, pay: 2000, spend: 1300, saved: 700, applied: true, moves: [{ accountId: "tfsa", name: "EQ TFSA", amount: 700 }] }]);
  });

  it("only logs when not applied, and keeps the latest 60", () => {
    const old = Array.from({ length: 60 }, (_, i) => ({ date: i, pay: 0, spend: 0, saved: 0, moves: [], applied: false }));
    const next = logPayday(2000, plan({ paydays: old }), acc, false, NOW);
    expect(next.acc).toEqual(acc);
    expect(next.plan.paydays).toHaveLength(60);
    expect(next.plan.paydays[59].date).toBe(NOW);
  });
});
