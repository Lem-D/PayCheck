import type { AccountsDoc, Plan, Purchase, SpendingDoc } from "../../types";

/** The two parts of the data that sync as a whole: the newest edit wins. Purchases sync one by one instead. */
export type SectionName = "accounts" | "plan";

export interface SectionMeta {
  /** When this device last changed the section, or when it took the cloud's copy. 0 means never. */
  updatedAt: number;
  /** Changed here and not yet confirmed saved in the cloud. */
  dirty: boolean;
}

export interface PurchaseMeta {
  /** Purchases added or edited here and not yet confirmed saved in the cloud. */
  dirty: string[];
  /** Purchases deleted here and not yet confirmed deleted in the cloud. */
  deleted: string[];
}

export interface SyncMeta {
  /** The account this device's data is linked to, or null when signed out. */
  uid: string | null;
  sections: Record<SectionName, SectionMeta>;
  purchases: PurchaseMeta;
}

export const emptyMeta = (): SyncMeta => ({
  uid: null,
  sections: { accounts: { updatedAt: 0, dirty: false }, plan: { updatedAt: 0, dirty: false } },
  purchases: { dirty: [], deleted: [] },
});

export interface RemoteSection {
  json: string;
  updatedAt: number;
}

/**
 * What to do when the cloud's copy of a section arrives.
 * "push": this device has a newer change, so send it. "pull": take the cloud's copy. "none": already the same.
 */
export function decideSection(local: SectionMeta, remote: RemoteSection | null): "push" | "pull" | "none" {
  if (!remote) return local.dirty ? "push" : "none";
  // Equal times while dirty means the cloud already has this change and its save is being confirmed.
  if (local.dirty) return local.updatedAt > remote.updatedAt ? "push" : local.updatedAt === remote.updatedAt ? "none" : "pull";
  return remote.updatedAt === local.updatedAt ? "none" : "pull";
}

const key = (p: Purchase) => JSON.stringify([p.id, p.categoryId, p.amount, p.note, p.at]);

/** Purchases added or changed (upserts) and removed (deletes) between two versions of the list. */
export function diffPurchases(prev: Purchase[], next: Purchase[]): { upserts: Purchase[]; deletes: string[] } {
  const before = new Map(prev.map((p) => [p.id, key(p)]));
  const ids = new Set(next.map((p) => p.id));
  return {
    upserts: next.filter((p) => before.get(p.id) !== key(p)),
    deletes: prev.filter((p) => !ids.has(p.id)).map((p) => p.id),
  };
}

/**
 * The purchase list after the cloud's list arrives: the cloud's purchases, except that this device's
 * unsaved additions, edits and deletions still apply on top.
 */
export function mergePurchases(remote: Purchase[], local: Purchase[], pending: PurchaseMeta): Purchase[] {
  const deleted = new Set(pending.deleted);
  const dirty = new Set(pending.dirty);
  const byId = new Map<string, Purchase>();
  for (const p of remote) if (!deleted.has(p.id)) byId.set(p.id, p);
  for (const p of local) if (dirty.has(p.id)) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

export const samePurchases = (a: Purchase[], b: Purchase[]) => a.length === b.length && JSON.stringify(sortById(a).map(key)) === JSON.stringify(sortById(b).map(key));
const sortById = (l: Purchase[]) => [...l].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

export interface Snapshot {
  acc: AccountsDoc;
  plan: Plan;
  spending: SpendingDoc;
}

export const isEmpty = ({ acc, plan, spending }: Snapshot) =>
  acc.accounts.length + acc.debts.length + plan.categories.length + plan.goals.length + plan.paydays.length + spending.purchases.length === 0;

/** JSON with object keys sorted, so the same data always gives the same text. */
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
}

/** Whether two copies of everything hold the same numbers. */
export const sameData = (a: Snapshot, b: Snapshot) => stable(a.acc) === stable(b.acc) && stable(a.plan) === stable(b.plan) && samePurchases(a.spending.purchases, b.spending.purchases);
