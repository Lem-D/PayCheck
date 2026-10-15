import { normalizeAccounts, normalizePlan } from "../normalize";
import type { Purchase } from "../../types";
import { decideSection, diffPurchases, emptyMeta, isEmpty, mergePurchases, sameData, samePurchases, stable, type RemoteSection, type SectionName, type Snapshot, type SyncMeta } from "./merge";

/** The cloud side of sync. `firebase.ts` is the real one; tests use an in-memory one. */
export interface Remote {
  readAll(): Promise<{ sections: Record<SectionName, RemoteSection | null>; purchases: Purchase[] }>;
  /** Calls back with the cloud's copy now and on every change. Returns a function that stops watching. */
  watchSection(name: SectionName, cb: (r: RemoteSection | null) => void, onError: (e: unknown) => void): () => void;
  watchPurchases(cb: (list: Purchase[]) => void, onError: (e: unknown) => void): () => void;
  /**
   * Saves a section. Resolves false when the cloud refused it because it already has a newer change, which
   * happens when a change made offline arrives after a later one from another device. The newer one then
   * arrives through watchSection.
   */
  putSection(name: SectionName, r: RemoteSection): Promise<boolean>;
  putPurchase(p: Purchase): Promise<void>;
  deletePurchase(id: string): Promise<void>;
}

/** The app side of sync: the data on this device. */
export interface Local {
  get(): Snapshot;
  /** Replaces parts of the data with the cloud's copy. */
  apply(patch: Partial<Snapshot>): void;
  saveMeta(meta: SyncMeta): void;
}

export type SyncStatus =
  | { state: "off" }
  | { state: "checking" }
  /** This device and the account both have different data, and the person picks which to keep. */
  | { state: "choose"; cloud: Snapshot }
  | { state: "saving" }
  | { state: "synced"; at: number }
  | { state: "error"; message: string };

const FIELD: Record<SectionName, "acc" | "plan"> = { accounts: "acc", plan: "plan" };
const SECTIONS: SectionName[] = ["accounts", "plan"];
const NORMALIZE = { accounts: normalizeAccounts, plan: normalizePlan };
const pkey = (p: Purchase) => JSON.stringify([p.categoryId, p.amount, p.note, p.at]);

export const OFFLINE = "Couldn't reach your account. Check your connection and try again.";
const SAVE_FAILED = "Your latest changes couldn't be saved to your account. They're still on this device. Sign out and back in to retry.";

function fromRemote(sections: Record<SectionName, RemoteSection | null>, purchases: Purchase[]): Snapshot {
  return {
    acc: normalizeAccounts(sections.accounts ? JSON.parse(sections.accounts.json) : null),
    plan: normalizePlan(sections.plan ? JSON.parse(sections.plan.json) : null),
    spending: { purchases: mergePurchases(purchases, [], { dirty: [], deleted: [] }) },
  };
}

/**
 * Keeps this device's data and the account's copy in step.
 * Accounts and the plan sync as a whole, newest change wins. Purchases sync one at a time, so purchases
 * logged on two devices both end up on both. Changes made offline are remembered and sent later.
 */
export class SyncEngine {
  private meta: SyncMeta;
  private base: Snapshot | null = null;
  private stops: (() => void)[] = [];
  private inFlight = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private status: SyncStatus = { state: "off" };
  private cloud: Awaited<ReturnType<Remote["readAll"]>> | null = null;
  private failed = false;

  constructor(
    private remote: Remote,
    private local: Local,
    meta: SyncMeta,
    private onStatus: (s: SyncStatus) => void,
    private debounceMs = 700,
    private now: () => number = Date.now,
  ) {
    this.meta = meta;
  }

  get linkedUid() {
    return this.meta.uid;
  }

  private set(s: SyncStatus) {
    this.status = s;
    this.onStatus(s);
  }

  private refresh() {
    if (this.status.state === "off" || this.status.state === "checking" || this.status.state === "choose") return;
    if (this.failed) this.set({ state: "error", message: SAVE_FAILED });
    else this.set(this.inFlight > 0 ? { state: "saving" } : { state: "synced", at: this.now() });
  }

  private save() {
    this.local.saveMeta(this.meta);
  }

  /** Signed in as `uid`: link this device's data to the account and start syncing. */
  async link(uid: string) {
    this.stopWatching();
    if (this.meta.uid === uid) return this.start();
    this.set({ state: "checking" });
    let cloud;
    try {
      cloud = await this.remote.readAll();
    } catch {
      return this.set({ state: "error", message: OFFLINE });
    }
    const theirs = fromRemote(cloud.sections, cloud.purchases);
    const mine = this.local.get();
    this.cloud = cloud;
    if (isEmpty(theirs)) this.keep("device", uid);
    else if (isEmpty(mine) || sameData(mine, theirs)) this.keep("cloud", uid);
    else this.set({ state: "choose", cloud: theirs });
  }

  /** Answer to "choose": keep the account's data on this device, or replace the account's data with this device's. */
  choose(which: "cloud" | "device", uid: string) {
    if (this.status.state !== "choose") return;
    this.keep(which, uid);
  }

  private keep(which: "cloud" | "device", uid: string) {
    const cloud = this.cloud!;
    this.cloud = null;
    const meta = emptyMeta();
    meta.uid = uid;
    if (which === "cloud") {
      const theirs = fromRemote(cloud.sections, cloud.purchases);
      for (const s of SECTIONS) meta.sections[s] = { updatedAt: cloud.sections[s]?.updatedAt ?? 0, dirty: false };
      this.local.apply(theirs);
    } else {
      const mine = this.local.get();
      for (const s of SECTIONS) meta.sections[s] = { updatedAt: Math.max(this.now(), (cloud.sections[s]?.updatedAt ?? 0) + 1), dirty: true };
      const ids = new Set(mine.spending.purchases.map((p) => p.id));
      meta.purchases = { dirty: [...ids], deleted: cloud.purchases.map((p) => p.id).filter((id) => !ids.has(id)) };
    }
    this.meta = meta;
    this.save();
    this.start();
  }

  private start() {
    this.base = this.local.get();
    this.failed = false;
    this.set({ state: "saving" });
    const onError = () => this.set({ state: "error", message: OFFLINE });
    for (const s of SECTIONS) this.stops.push(this.remote.watchSection(s, (r) => this.onSection(s, r), onError));
    this.stops.push(this.remote.watchPurchases((l) => this.onPurchases(l), onError));
    // Send purchase changes left over from last time, such as ones made offline.
    const local = new Map(this.base.spending.purchases.map((p) => [p.id, p]));
    for (const id of this.meta.purchases.dirty) {
      const p = local.get(id);
      if (p) this.pushPurchase(p);
    }
    for (const id of this.meta.purchases.deleted) this.pushDelete(id);
    this.refresh();
  }

  private stopWatching() {
    this.stops.forEach((f) => f());
    this.stops = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Stop syncing, for example when signing out. The data stays on this device. */
  unlink() {
    this.stopWatching();
    this.base = null;
    this.cloud = null;
    this.meta = emptyMeta();
    this.save();
    this.set({ state: "off" });
  }

  /** Stop watching without forgetting the link, for example when the app closes. */
  pause() {
    this.flush();
    this.stopWatching();
  }

  /** The data on this device changed. Sends the change shortly after, so typing doesn't send every keystroke. */
  touch() {
    if (!this.base) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  /** Works out what changed on this device since the last look, and sends it. */
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.base) return;
    const next = this.local.get();
    for (const s of SECTIONS) {
      const f = FIELD[s];
      if (next[f] === this.base[f] || stable(next[f]) === stable(this.base[f])) continue;
      const m = this.meta.sections[s];
      m.updatedAt = Math.max(this.now(), m.updatedAt + 1);
      m.dirty = true;
      this.pushSection(s, next);
    }
    if (next.spending !== this.base.spending) {
      const { upserts, deletes } = diffPurchases(this.base.spending.purchases, next.spending.purchases);
      const pm = this.meta.purchases;
      for (const p of upserts) {
        if (!pm.dirty.includes(p.id)) pm.dirty.push(p.id);
        pm.deleted = pm.deleted.filter((id) => id !== p.id);
        this.pushPurchase(p);
      }
      for (const id of deletes) {
        pm.dirty = pm.dirty.filter((d) => d !== id);
        if (!pm.deleted.includes(id)) pm.deleted.push(id);
        this.pushDelete(id);
      }
    }
    this.base = next;
    this.save();
  }

  private track<T>(p: Promise<T>, done: (v: T) => void) {
    this.inFlight++;
    this.refresh();
    p.then(done, () => {
      this.failed = true;
    }).finally(() => {
      this.inFlight--;
      this.save();
      this.refresh();
    });
  }

  private pushSection(s: SectionName, from: Snapshot) {
    const at = this.meta.sections[s].updatedAt;
    this.track(this.remote.putSection(s, { json: stable(from[FIELD[s]]), updatedAt: at }), (saved) => {
      if (saved && this.meta.sections[s].updatedAt === at) this.meta.sections[s].dirty = false;
    });
  }

  private pushPurchase(p: Purchase) {
    const sent = pkey(p);
    this.track(this.remote.putPurchase(p), () => {
      const now = this.base?.spending.purchases.find((x) => x.id === p.id);
      if (now && pkey(now) === sent) this.meta.purchases.dirty = this.meta.purchases.dirty.filter((id) => id !== p.id);
    });
  }

  private pushDelete(id: string) {
    this.track(this.remote.deletePurchase(id), () => {
      if (!this.base?.spending.purchases.some((p) => p.id === id)) this.meta.purchases.deleted = this.meta.purchases.deleted.filter((d) => d !== id);
    });
  }

  private onSection(s: SectionName, r: RemoteSection | null) {
    if (!this.base) return;
    this.flush();
    const what = decideSection(this.meta.sections[s], r);
    if (what === "push") this.pushSection(s, this.base);
    else if (what === "pull" && r) {
      const data = NORMALIZE[s](JSON.parse(r.json));
      this.meta.sections[s] = { updatedAt: r.updatedAt, dirty: false };
      this.base = { ...this.base, [FIELD[s]]: data };
      this.local.apply({ [FIELD[s]]: data });
      this.save();
    }
    this.refresh();
  }

  private onPurchases(list: Purchase[]) {
    if (!this.base) return;
    this.flush();
    const merged = mergePurchases(list, this.base.spending.purchases, this.meta.purchases);
    if (!samePurchases(merged, this.base.spending.purchases)) {
      const spending = { purchases: merged };
      this.base = { ...this.base, spending };
      this.local.apply({ spending });
    }
    this.refresh();
  }
}
