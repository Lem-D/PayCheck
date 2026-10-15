import { describe, expect, it } from "@jest/globals";
import { backupName, makeBackup, readBackup } from "./backup";
import type { BackupData } from "./backup";
import { emptyPlan } from "../types";

describe("backup", () => {
  const data: BackupData = {
    acc: { accounts: [{ id: "a", name: "Chequing", kind: "Chequing", balance: 1240.5 }], debts: [{ id: "d", name: "Visa", kind: "Credit card", balance: 300, rate: 20.99 }] },
    plan: {
      ...emptyPlan(),
      frequency: "weekly",
      categories: [{ id: "g", name: "Groceries", limit: 120 }],
      goals: [{ id: "ef", name: "Emergency fund", accountId: "a", target: 5000, saved: 1250, date: "2027-06-30" }],
      extraTo: "goal:ef",
      paydays: [{ date: 1, pay: 900, spend: 120, saved: 780, moves: [], applied: true, limits: [{ id: "g", name: "Groceries", limit: 120 }], goals: [{ id: "ef", amount: 780 }] }],
    },
    spending: { purchases: [{ id: "p", categoryId: "g", amount: 42.1, note: "Costco", at: 2 }] },
  };

  it("round-trips everything: balances, goals and their progress, limits, paydays and purchases", () => {
    const r = readBackup(makeBackup(data, 1792000000000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect({ acc: r.acc, plan: r.plan, spending: r.spending }).toEqual(data);
    expect(r.summary).toEqual({ exportedAt: 1792000000000, accounts: 1, debts: 1, goals: 1, limits: 1, paydays: 1, purchases: 1 });
  });

  it("refuses files that aren't PayCheck backups", () => {
    expect(readBackup("not json").ok).toBe(false);
    expect(readBackup(JSON.stringify({ accounts: [] })).ok).toBe(false);
  });

  it("refuses backups from a newer version", () => {
    const r = readBackup(JSON.stringify({ kind: "paycheck-backup", version: 2 }));
    expect(r.ok === false && r.error).toMatch(/newer version/);
  });

  it("fills in anything missing from an older or partial file", () => {
    const r = readBackup(JSON.stringify({ kind: "paycheck-backup", version: 1, plan: { goals: [{ id: "x", name: "Trip", target: "400" }] } }));
    expect(r.ok && r.plan.goals[0]).toEqual({ id: "x", name: "Trip", target: 400, saved: 0, date: "", accountId: "" });
    expect(r.ok && r.acc).toEqual({ accounts: [], debts: [] });
  });

  it("names the file by date", () => {
    expect(backupName(new Date("2026-10-15T09:00:00").getTime())).toBe("PayCheck backup 2026-10-15.json");
  });
});
