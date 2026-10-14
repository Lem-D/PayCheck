import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { emptyAccounts, emptyPlan, emptySpending, type AccountsDoc, type Plan, type SpendingDoc } from "../types";
import { normalizeAccounts, normalizePlan, normalizeSpending } from "./normalize";

// Same keys and shapes as the original web page, so its data could be imported later.
const KEYS = { accounts: "paycheque-plan-accounts", plan: "paycheque-plan-plan", spending: "paycheque-plan-spending" } as const;

interface Store {
  ready: boolean;
  saveError: boolean;
  acc: AccountsDoc;
  setAcc: Dispatch<SetStateAction<AccountsDoc>>;
  plan: Plan;
  setPlan: Dispatch<SetStateAction<Plan>>;
  spending: SpendingDoc;
  setSpending: Dispatch<SetStateAction<SpendingDoc>>;
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

/** Keeps accounts, the paycheque plan and purchases on the phone, saving shortly after each change. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [acc, setAcc] = useState<AccountsDoc>(emptyAccounts);
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [spending, setSpending] = useState<SpendingDoc>(emptySpending);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([load(KEYS.accounts, normalizeAccounts), load(KEYS.plan, normalizePlan), load(KEYS.spending, normalizeSpending)]).then(([a, p, sp]) => {
      setAcc(a);
      setPlan(p);
      setSpending(sp);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
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

  return <StoreContext.Provider value={{ ready, saveError, acc, setAcc, plan, setPlan, spending, setSpending }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
