import { describe, expect, it } from "@jest/globals";
import { logPayday } from "./allocate";
import { periods, summarize, trackGoals } from "./history";
import { emptyPlan, type Payday, type Plan, type Purchase } from "../types";

const DAY = 86_400_000;
const T0 = new Date("2026-09-02T09:00:00").getTime();
const NOW = T0 + 43 * DAY;

const day = (d: number, over: Partial<Payday> = {}): Payday => ({
  date: T0 + d * DAY,
  pay: 2000,
  spend: 1400,
  saved: 600,
  moves: [],
  applied: true,
  limits: [
    { id: "g", name: "Groceries", limit: 300 },
    { id: "e", name: "Eating out", limit: 100 },
  ],
  ...over,
});
const buy = (d: number, categoryId: string, amount: number): Purchase => ({ id: `${d}${categoryId}${amount}`, categoryId, amount, note: "", at: T0 + d * DAY });

const plan = (over: Partial<Plan> = {}): Plan => ({
  ...emptyPlan(),
  categories: [
    { id: "g", name: "Groceries", limit: 350 },
    { id: "e", name: "Eating out", limit: 100 },
  ],
  paydays: [day(0), day(14), day(28, { saved: 400 }), day(42)],
  ...over,
});

const purchases = [buy(1, "g", 250), buy(5, "e", 130), buy(15, "g", 300), buy(16, "e", 40), buy(29, "g", 120), buy(30, "x", 25), buy(43, "e", 20)];

describe("periods", () => {
  it("splits purchases at each logged payday, newest first", () => {
    const r = periods(plan(), purchases, NOW);
    expect(r.map((p) => p.open)).toEqual([true, false, false, false]);
    expect(r.map((p) => p.spent)).toEqual([20, 145, 340, 380]);
    expect(r[3].end).toBe(T0 + 14 * DAY);
  });

  it("judges each period against the limits recorded on its payday", () => {
    const [, third, second, first] = periods(plan(), purchases, NOW);
    expect(first.limits.map((l) => [l.name, l.kept, l.over])).toEqual([
      ["Groceries", true, 0],
      ["Eating out", false, 30],
    ]);
    // Spending exactly the limit still counts as kept.
    expect(second.kept).toBe(2);
    expect(third.other).toBe(25);
    expect(third.rate).toBe(0.2);
  });

  it("falls back to today's limits for paydays logged before limits were recorded", () => {
    const r = periods(plan({ paydays: [day(0, { limits: undefined }), day(14)] }), purchases, NOW);
    expect(r[1].todaysLimits).toBe(true);
    expect(r[1].limits[0].limit).toBe(350);
  });
});

describe("summarize", () => {
  it("counts finished periods only and the streak of fully kept ones", () => {
    const s = summarize(periods(plan(), purchases, NOW));
    expect(s.periods).toBe(3);
    expect(s.saved).toBe(1600);
    expect(s.avgSaved).toBe(533.33);
    expect([s.kept, s.limits]).toEqual([5, 6]);
    expect(s.streak).toBe(2);
    expect(s.categories.find((c) => c.id === "e")).toMatchObject({ kept: 2, of: 3, marks: [false, true, true] });
  });

  it("is empty before two paydays are logged", () => {
    const s = summarize(periods(plan({ paydays: [day(42)] }), purchases, NOW));
    expect([s.periods, s.saved, s.streak]).toEqual([0, 0, 0]);
  });
});

describe("trackGoals", () => {
  const goals = [
    { id: "trip", name: "Trip", accountId: "", target: 1000, saved: 400, date: "2026-12-22" },
    { id: "ef", name: "Emergency fund", accountId: "", target: 5000, saved: 1000, date: "2027-01-19" },
    { id: "done", name: "Laptop", accountId: "", target: 500, saved: 500, date: "" },
  ];

  it("compares what each goal got lately with what it needs", () => {
    const now = new Date("2026-10-14T12:00:00").getTime();
    const p = plan({
      goals,
      paydays: [day(0, { goals: [{ id: "trip", amount: 150 }] }), day(14, { goals: [{ id: "trip", amount: 90 }, { id: "ef", amount: 300 }] })],
    });
    const t = trackGoals(p, now);
    // Trip needs $120 for each of five paydays; it got $120 on average.
    expect(t[0]).toMatchObject({ status: "on-track", need: 120, getting: 120 });
    expect(t[1]).toMatchObject({ status: "behind", getting: 150 });
    expect(t[1].need).toBeGreaterThan(150);
    expect(t[2].status).toBe("reached");
  });

  it("says nothing about pace until a payday records goal shares", () => {
    expect(trackGoals(plan({ goals, paydays: [day(0, { goals: undefined })] }))[0].status).toBe("new");
  });

  it("records limits and goal shares when a payday is logged", () => {
    const p = plan({ goals: [goals[0]], paydays: [], extraTo: "" });
    const { plan: after } = logPayday(2000, p, { accounts: [], debts: [] }, false, new Date("2026-10-14T12:00:00").getTime());
    expect(after.paydays[0].limits).toEqual([
      { id: "g", name: "Groceries", limit: 350 },
      { id: "e", name: "Eating out", limit: 100 },
    ]);
    expect(after.paydays[0].goals).toEqual([{ id: "trip", amount: 120 }]);
  });
});
