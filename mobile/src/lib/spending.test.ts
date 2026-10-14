import { describe, expect, it } from "@jest/globals";
import { addPurchase, categoryStatus, currentPeriod, inPeriod, levelFor, MAX_PURCHASES, periodTotals } from "./spending";
import { emptyPlan, type Plan, type Purchase } from "../types";

const DAY = 86_400_000;
const NOW = new Date("2026-10-14T12:00:00").getTime();
const payday = (date: number) => ({ date, pay: 2000, spend: 1300, saved: 700, moves: [], applied: true });
const buy = (categoryId: string, amount: number, at: number, id = `${categoryId}-${at}`): Purchase => ({ id, categoryId, amount, note: "", at });

const plan = (over: Partial<Plan> = {}): Plan => ({
  ...emptyPlan(),
  categories: [
    { id: "groc", name: "Groceries", limit: 300 },
    { id: "eat", name: "Eating out", limit: 100 },
  ],
  ...over,
});

describe("currentPeriod", () => {
  it("runs from the last logged payday for one pay period", () => {
    const p = currentPeriod(plan({ paydays: [payday(NOW - 20 * DAY), payday(NOW - 4 * DAY)] }), NOW);
    expect(p.start).toBe(NOW - 4 * DAY);
    expect(p.next).toBe(NOW + 10 * DAY);
    expect(p.daysLeft).toBe(10);
  });

  it("uses the pay frequency", () => {
    expect(currentPeriod(plan({ frequency: "weekly", paydays: [payday(NOW - 2 * DAY)] }), NOW).daysLeft).toBe(5);
  });

  it("never counts below zero days when payday is late", () => {
    expect(currentPeriod(plan({ paydays: [payday(NOW - 20 * DAY)] }), NOW).daysLeft).toBe(0);
  });

  it("has no start before any payday is logged", () => {
    expect(currentPeriod(plan(), NOW)).toEqual({ start: null, next: null, daysLeft: null });
  });
});

describe("levelFor", () => {
  it("warns from 75% and flags 100% or more", () => {
    expect(levelFor(74, 100)).toBe("ok");
    expect(levelFor(75, 100)).toBe("warn");
    expect(levelFor(100, 100)).toBe("over");
    expect(levelFor(5, 0)).toBe("over");
    expect(levelFor(0, 0)).toBe("ok");
  });
});

describe("categoryStatus", () => {
  it("only counts purchases since the period started", () => {
    const p = plan({ paydays: [payday(NOW - 3 * DAY)] });
    const purchases = [buy("groc", 50, NOW - 5 * DAY), buy("groc", 120.5, NOW - 1 * DAY), buy("groc", 110, NOW), buy("eat", 30, NOW)];
    const period = currentPeriod(p, NOW);
    expect(inPeriod(purchases, period)).toHaveLength(3);
    const [groc, eat] = categoryStatus(p, purchases, period);
    expect(groc).toMatchObject({ spent: 230.5, left: 69.5, level: "warn" });
    expect(eat).toMatchObject({ spent: 30, left: 70, level: "ok" });
  });

  it("goes negative and flags over the limit", () => {
    const p = plan();
    const [, eat] = categoryStatus(p, [buy("eat", 130, NOW)], currentPeriod(p, NOW));
    expect(eat).toMatchObject({ left: -30, level: "over" });
  });
});

describe("periodTotals", () => {
  it("adds up limits and spending, including deleted categories", () => {
    const p = plan();
    const t = periodTotals(p, [buy("groc", 100, NOW), buy("gone", 20, NOW)], currentPeriod(p, NOW));
    expect(t).toEqual({ limit: 400, spent: 120, left: 280, other: 20, level: "ok" });
  });
});

describe("addPurchase", () => {
  it("keeps newest first and caps the list", () => {
    const many = Array.from({ length: MAX_PURCHASES }, (_, i) => buy("groc", 1, i, `p${i}`)).reverse();
    const next = addPurchase(many, buy("eat", 5, NOW, "new"));
    expect(next).toHaveLength(MAX_PURCHASES);
    expect(next[0].id).toBe("new");
    expect(next.some((p) => p.id === "p0")).toBe(false);
  });
});
