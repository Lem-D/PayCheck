import { describe, expect, test } from "@jest/globals";
import { emptyAccounts, emptyPlan, type Purchase } from "../../types";
import { SyncEngine, type Local, type Remote, type SyncStatus } from "./engine";
import { decideSection, diffPurchases, emptyMeta, mergePurchases, type RemoteSection, type SectionName, type Snapshot, type SyncMeta } from "./merge";

/** One shared cloud, like a Firestore project. Each device connects to it and can go offline. */
class Cloud {
  sections: Record<SectionName, RemoteSection | null> = { accounts: null, plan: null };
  purchases = new Map<string, Purchase>();
  private watchers = new Set<() => void>();
  notify() {
    this.watchers.forEach((w) => w());
  }
  connect(): Remote & { online: boolean; goOnline(): void } {
    const cloud = this;
    const queue: (() => void)[] = [];
    const conn = {
      online: true,
      goOnline() {
        conn.online = true;
        queue.splice(0).forEach((f) => f());
        cloud.notify();
      },
      write<T>(f: () => T) {
        return new Promise<T>((resolve) => {
          const run = () => {
            const v = f();
            cloud.notify();
            resolve(v);
          };
          if (conn.online) queueMicrotask(run);
          else queue.push(run);
        });
      },
      async readAll() {
        if (!conn.online) throw new Error("offline");
        return { sections: { ...cloud.sections }, purchases: [...cloud.purchases.values()] };
      },
      watchSection(name: SectionName, cb: (r: RemoteSection | null) => void) {
        const w = () => conn.online && cb(cloud.sections[name]);
        cloud.watchers.add(w);
        queueMicrotask(w);
        return () => cloud.watchers.delete(w);
      },
      watchPurchases(cb: (l: Purchase[]) => void) {
        const w = () => conn.online && cb([...cloud.purchases.values()]);
        cloud.watchers.add(w);
        queueMicrotask(w);
        return () => cloud.watchers.delete(w);
      },
      // Like the Firestore rules: a section can only be replaced by a newer change.
      putSection: (name: SectionName, r: RemoteSection) =>
        conn.write(() => {
          const old = cloud.sections[name];
          if (old && old.updatedAt >= r.updatedAt) return false;
          cloud.sections[name] = r;
          return true;
        }),
      putPurchase: (p: Purchase) =>
        conn.write(() => {
          cloud.purchases.set(p.id, { ...p });
        }),
      deletePurchase: (id: string) =>
        conn.write(() => {
          cloud.purchases.delete(id);
        }),
    };
    return conn;
  }
}

/** A phone running the app: its own data, its saved sync notes, and a connection to the cloud. */
function device(cloud: Cloud, start?: Partial<Snapshot>, clock = { t: 1000 }) {
  let data: Snapshot = { acc: emptyAccounts(), plan: emptyPlan(), spending: { purchases: [] }, ...start };
  let saved: SyncMeta = emptyMeta();
  const statuses: SyncStatus[] = [];
  const local: Local = {
    get: () => data,
    apply: (patch) => (data = { ...data, ...patch }),
    saveMeta: (m) => (saved = JSON.parse(JSON.stringify(m))),
  };
  const remote = cloud.connect();
  const engine = new SyncEngine(remote, local, emptyMeta(), (s) => statuses.push(s), 0, () => ++clock.t);
  return {
    engine,
    remote,
    get data() {
      return data;
    },
    /** A change made in the app, like typing a balance. */
    edit(patch: Partial<Snapshot>) {
      data = { ...data, ...patch };
      engine.touch();
    },
    get meta() {
      return saved;
    },
    get status() {
      return statuses[statuses.length - 1];
    },
  };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};
const buy = (id: string, amount: number, at = 1): Purchase => ({ id, categoryId: "food", amount, note: "", at });
const chequing = (balance: number) => ({ accounts: [{ id: "a", name: "Chequing", kind: "Chequing", balance }], debts: [] });

describe("merge rules", () => {
  test("a newer change here is sent, a newer change in the cloud is taken", () => {
    expect(decideSection({ updatedAt: 5, dirty: true }, { json: "", updatedAt: 3 })).toBe("push");
    expect(decideSection({ updatedAt: 5, dirty: true }, { json: "", updatedAt: 9 })).toBe("pull");
    expect(decideSection({ updatedAt: 5, dirty: true }, { json: "", updatedAt: 5 })).toBe("none");
    expect(decideSection({ updatedAt: 5, dirty: false }, { json: "", updatedAt: 9 })).toBe("pull");
    expect(decideSection({ updatedAt: 5, dirty: false }, null)).toBe("none");
    expect(decideSection({ updatedAt: 5, dirty: true }, null)).toBe("push");
  });

  test("purchase changes are found one by one", () => {
    const d = diffPurchases([buy("a", 1), buy("b", 2)], [buy("a", 5), buy("c", 3)]);
    expect(d.upserts.map((p) => p.id)).toEqual(["a", "c"]);
    expect(d.deletes).toEqual(["b"]);
  });

  test("unsaved purchases here survive the cloud's list arriving", () => {
    const merged = mergePurchases([buy("a", 1), buy("gone", 2)], [buy("new", 3), buy("gone", 2)], { dirty: ["new"], deleted: ["gone"] });
    expect(merged.map((p) => p.id).sort()).toEqual(["a", "new"]);
  });
});

describe("syncing two devices", () => {
  test("the first device uploads, the second gets everything", async () => {
    const cloud = new Cloud();
    const phone = device(cloud, { acc: chequing(500), spending: { purchases: [buy("p1", 20)] } });
    await phone.engine.link("lem");
    await settle();
    expect(phone.status.state).toBe("synced");
    expect(cloud.purchases.has("p1")).toBe(true);

    const mac = device(cloud);
    await mac.engine.link("lem");
    await settle();
    expect(mac.data.acc.accounts[0].balance).toBe(500);
    expect(mac.data.spending.purchases.map((p) => p.id)).toEqual(["p1"]);
  });

  test("changes on one show up on the other, both ways", async () => {
    const cloud = new Cloud();
    const phone = device(cloud, { acc: chequing(500) });
    const mac = device(cloud);
    await phone.engine.link("lem");
    await settle();
    await mac.engine.link("lem");
    await settle();

    phone.edit({ acc: chequing(650) });
    await settle();
    expect(mac.data.acc.accounts[0].balance).toBe(650);

    mac.edit({ spending: { purchases: [buy("m1", 12)] } });
    await settle();
    expect(phone.data.spending.purchases.map((p) => p.id)).toEqual(["m1"]);

    phone.edit({ spending: { purchases: [] } });
    await settle();
    expect(mac.data.spending.purchases).toEqual([]);
    expect(cloud.purchases.size).toBe(0);
  });

  test("purchases logged on both devices while one is offline all end up on both", async () => {
    const cloud = new Cloud();
    const clock = { t: 1000 };
    const phone = device(cloud, {}, clock);
    const mac = device(cloud, {}, clock);
    await phone.engine.link("lem");
    await settle();
    await mac.engine.link("lem");
    await settle();

    phone.remote.online = false;
    phone.edit({ spending: { purchases: [buy("phone-coffee", 4)] }, acc: chequing(100) });
    mac.edit({ spending: { purchases: [buy("mac-lunch", 15)] } });
    await settle();
    expect(phone.meta.purchases.dirty).toEqual(["phone-coffee"]);

    phone.remote.goOnline();
    await settle();
    const ids = (d: { data: Snapshot }) => d.data.spending.purchases.map((p) => p.id).sort();
    expect(ids(phone)).toEqual(["mac-lunch", "phone-coffee"]);
    expect(ids(mac)).toEqual(["mac-lunch", "phone-coffee"]);
    expect(mac.data.acc.accounts[0].balance).toBe(100);
    expect(phone.meta.purchases.dirty).toEqual([]);
  });

  test("the newest change wins when both edit the same thing", async () => {
    const cloud = new Cloud();
    const clock = { t: 1000 };
    const phone = device(cloud, { acc: chequing(1) }, clock);
    const mac = device(cloud, {}, clock);
    await phone.engine.link("lem");
    await settle();
    await mac.engine.link("lem");
    await settle();

    phone.remote.online = false;
    phone.edit({ acc: chequing(200) });
    await settle();
    mac.edit({ acc: chequing(300) });
    await settle();
    phone.remote.goOnline();
    await settle();
    expect(phone.data.acc.accounts[0].balance).toBe(300);
    expect(mac.data.acc.accounts[0].balance).toBe(300);
  });

  test("signing in with different data on both sides asks which to keep", async () => {
    const cloud = new Cloud();
    const phone = device(cloud, { acc: chequing(500) });
    await phone.engine.link("lem");
    await settle();

    const mac = device(cloud, { acc: chequing(9), spending: { purchases: [buy("old", 1)] } });
    await mac.engine.link("lem");
    expect(mac.status.state).toBe("choose");
    expect(mac.data.acc.accounts[0].balance).toBe(9);

    mac.engine.choose("device", "lem");
    await settle();
    expect(phone.data.acc.accounts[0].balance).toBe(9);
    expect(phone.data.spending.purchases.map((p) => p.id)).toEqual(["old"]);
  });

  test("keeping the account's data replaces this device's", async () => {
    const cloud = new Cloud();
    const phone = device(cloud, { acc: chequing(500), spending: { purchases: [buy("p", 1)] } });
    await phone.engine.link("lem");
    await settle();
    const mac = device(cloud, { acc: chequing(9) });
    await mac.engine.link("lem");
    mac.engine.choose("cloud", "lem");
    await settle();
    expect(mac.data.acc.accounts[0].balance).toBe(500);
    expect(mac.data.spending.purchases.map((p) => p.id)).toEqual(["p"]);
    expect(phone.data.acc.accounts[0].balance).toBe(500);
  });

  test("signing in offline says so and changes nothing", async () => {
    const cloud = new Cloud();
    const phone = device(cloud, { acc: chequing(5) });
    phone.remote.online = false;
    await phone.engine.link("lem");
    expect(phone.status.state).toBe("error");
    expect(phone.data.acc.accounts[0].balance).toBe(5);
  });
});
