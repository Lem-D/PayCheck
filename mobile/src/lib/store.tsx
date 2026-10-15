import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { emptyAccounts, emptyPlan, emptySpending, type AccountsDoc, type Plan, type SpendingDoc } from "../types";
import { normalizeAccounts, normalizePlan, normalizeSpending } from "./normalize";
import { activeConfig, emulatorHost } from "./sync/config";
import { SyncEngine, type SyncStatus } from "./sync/engine";
import { emptyMeta, type Snapshot, type SyncMeta } from "./sync/merge";

// Same keys and shapes as the original web page, so its data could be imported later.
const KEYS = { accounts: "paycheque-plan-accounts", plan: "paycheque-plan-plan", spending: "paycheque-plan-spending" } as const;
const SYNC_KEY = "paycheque-plan-sync";

export interface Sync {
  /** False until a Firebase project is set in `sync/config.ts`. */
  available: boolean;
  status: SyncStatus;
  /** The signed-in account's email, or null. */
  email: string | null;
  /** Each returns an error message to show, or null when it worked. */
  signIn(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<string | null>;
  resetPassword(email: string): Promise<string | null>;
  signOut(): Promise<void>;
  /** Answers "which data do you want to keep" after signing in. */
  choose(which: "cloud" | "device"): void;
  /** Tries connecting again after an error. */
  retry(): void;
}

interface Store {
  ready: boolean;
  saveError: boolean;
  acc: AccountsDoc;
  setAcc: Dispatch<SetStateAction<AccountsDoc>>;
  plan: Plan;
  setPlan: Dispatch<SetStateAction<Plan>>;
  spending: SpendingDoc;
  setSpending: Dispatch<SetStateAction<SpendingDoc>>;
  sync: Sync;
}

const StoreContext = createContext<Store | null>(null);

async function load<T>(key: string, normalize: (d: unknown) => T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return normalize(null);
  }
}

async function loadMeta(): Promise<SyncMeta> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_KEY);
    return raw ? { ...emptyMeta(), ...JSON.parse(raw) } : emptyMeta();
  } catch {
    return emptyMeta();
  }
}

// Firebase is only loaded when sync is set up, so the app stays small and starts fast without it.
const firebase = () => import("./sync/firebase");

/** Keeps accounts, the paycheque plan and purchases on the phone, saving shortly after each change, and syncs them when signed in. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [acc, setAcc] = useState<AccountsDoc>(emptyAccounts);
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [spending, setSpending] = useState<SpendingDoc>(emptySpending);
  const [status, setStatus] = useState<SyncStatus>({ state: "off" });
  const [email, setEmail] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engine = useRef<SyncEngine | null>(null);
  const uid = useRef<string | null>(null);
  const meta = useRef<SyncMeta>(emptyMeta());

  // The latest data, kept up to date right away (state updates land a moment later), for the sync engine to read.
  const current = useRef<Snapshot>({ acc, plan, spending });
  current.current = { acc, plan, spending };

  useEffect(() => {
    // In a browser or the home screen app, ask for the data to be kept even when the device is low on space.
    if (Platform.OS === "web") navigator.storage?.persist?.().catch(() => {});
    Promise.all([load(KEYS.accounts, normalizeAccounts), load(KEYS.plan, normalizePlan), load(KEYS.spending, normalizeSpending), loadMeta()]).then(async ([a, p, sp, m]) => {
      meta.current = m;
      current.current = { acc: a, plan: p, spending: sp };
      setAcc(a);
      setPlan(p);
      setSpending(sp);
      setReady(true);
      if (!activeConfig) return;
      const fb = await firebase();
      const cloud = fb.connect(activeConfig, emulatorHost);
      fb.watchUser(cloud, (user) => {
        setEmail(user?.email ?? null);
        uid.current = user?.uid ?? null;
        engine.current?.pause();
        engine.current = null;
        if (!user) {
          // Signed out, or the sign-in ran out. Keep the link to the account so nothing unsaved is forgotten.
          setStatus({ state: "off" });
          return;
        }
        const e = new SyncEngine(
          fb.firestoreRemote(cloud.db, user.uid),
          {
            get: () => current.current,
            apply: (patch) => {
              current.current = { ...current.current, ...patch };
              if (patch.acc) setAcc(patch.acc);
              if (patch.plan) setPlan(patch.plan);
              if (patch.spending) setSpending(patch.spending);
            },
            saveMeta: (m) => {
              const text = JSON.stringify(m);
              meta.current = JSON.parse(text);
              AsyncStorage.setItem(SYNC_KEY, text).catch(() => {});
            },
          },
          JSON.parse(JSON.stringify(meta.current)),
          setStatus,
        );
        engine.current = e;
        e.link(user.uid);
      });
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    engine.current?.touch();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const now = Date.now();
      AsyncStorage.multiSet([
        [KEYS.accounts, JSON.stringify({ ...acc, updatedAt: now })],
        [KEYS.plan, JSON.stringify({ ...plan, updatedAt: now })],
        [KEYS.spending, JSON.stringify({ ...spending, updatedAt: now })],
      ])
        .then(() => setSaveError(false))
        .catch(() => setSaveError(true));
    }, 400);
  }, [ready, acc, plan, spending]);

  // Send any change still waiting when the app goes to the background, since it may be closed there.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s !== "active" && engine.current?.flush());
    return () => sub.remove();
  }, []);

  const withCloud = useCallback(async <T,>(f: (fb: Awaited<ReturnType<typeof firebase>>, c: ReturnType<Awaited<ReturnType<typeof firebase>>["connect"]>) => Promise<T>) => {
    const fb = await firebase();
    return f(fb, fb.connect(activeConfig!, emulatorHost));
  }, []);

  const sync = useMemo<Sync>(() => {
    const attempt = (f: Parameters<typeof withCloud>[0]) =>
      withCloud(f).then(
        () => null,
        async (e) => (await firebase()).authMessage(e),
      );
    return {
      available: !!activeConfig,
      status,
      email,
      signIn: (em, pw) => attempt((fb, c) => fb.signIn(c, em, pw)),
      signUp: (em, pw) => attempt((fb, c) => fb.signUp(c, em, pw)),
      resetPassword: (em) => attempt((fb, c) => fb.resetPassword(c, em)),
      signOut: async () => {
        engine.current?.unlink();
        engine.current = null;
        await withCloud((fb, c) => fb.logOut(c));
      },
      choose: (which) => {
        if (uid.current) engine.current?.choose(which, uid.current);
      },
      retry: () => {
        if (uid.current) engine.current?.link(uid.current);
      },
    };
  }, [status, email, withCloud]);

  return <StoreContext.Provider value={{ ready, saveError, acc, setAcc, plan, setPlan, spending, setSpending, sync }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
