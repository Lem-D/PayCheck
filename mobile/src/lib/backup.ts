import { normalizeAccounts, normalizePlan, normalizeSpending } from "./normalize";
import type { AccountsDoc, Plan, SpendingDoc } from "../types";

const KIND = "paycheck-backup";
const VERSION = 1;

export interface BackupData {
  acc: AccountsDoc;
  plan: Plan;
  spending: SpendingDoc;
}

export interface BackupSummary {
  exportedAt: number | null;
  accounts: number;
  debts: number;
  goals: number;
  limits: number;
  paydays: number;
  purchases: number;
}

/** Everything the app keeps, as one JSON file. */
export function makeBackup({ acc, plan, spending }: BackupData, now = Date.now()): string {
  return JSON.stringify({ kind: KIND, version: VERSION, exportedAt: now, accounts: acc, plan, spending }, null, 2);
}

const pad = (n: number) => String(n).padStart(2, "0");
export function backupName(now = Date.now()): string {
  const d = new Date(now);
  return `PayCheck backup ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export const summarizeBackup = ({ acc, plan, spending }: BackupData, exportedAt: number | null): BackupSummary => ({
  exportedAt,
  accounts: acc.accounts.length,
  debts: acc.debts.length,
  goals: plan.goals.length,
  limits: plan.categories.length,
  paydays: plan.paydays.length,
  purchases: spending.purchases.length,
});

export type ReadResult = ({ ok: true; summary: BackupSummary } & BackupData) | { ok: false; error: string };

/** Checks a backup file and cleans it up the same way saved data is when the app starts. */
export function readBackup(text: string): ReadResult {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a PayCheck backup. Pick a file named like “PayCheck backup 2026-10-15.json”." };
  }
  if (!o || typeof o !== "object" || o.kind !== KIND) return { ok: false, error: "That file isn't a PayCheck backup. Pick a file named like “PayCheck backup 2026-10-15.json”." };
  if (typeof o.version !== "number" || o.version > VERSION) return { ok: false, error: "This backup was made by a newer version of PayCheck. Update the app, then try again." };
  const data = { acc: normalizeAccounts(o.accounts), plan: normalizePlan(o.plan), spending: normalizeSpending(o.spending) };
  return { ok: true, ...data, summary: summarizeBackup(data, typeof o.exportedAt === "number" ? o.exportedAt : null) };
}
