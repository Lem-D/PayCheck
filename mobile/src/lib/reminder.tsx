import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { askToNotify, canNotify, cancelReminders, scheduleReminders } from "./notify";
import { nextPaydays } from "./paydays";
import { useStore } from "./store";

// Kept on this device only: each phone asks for its own permission to send notifications.
const KEY = "paycheque-plan-reminder";

export interface ReminderSettings {
  on: boolean;
  /** Hour of the day, 0 to 23. */
  hour: number;
}

interface Reminder {
  settings: ReminderSettings;
  /** Turns reminders on or off, or changes the time. Resolves an error to show, or null. */
  update(patch: Partial<ReminderSettings>): Promise<string | null>;
}

const DEFAULTS: ReminderSettings = { on: false, hour: 9 };
/** iPhones keep at most 64 waiting notifications, so schedule a few months ahead and top up each time the app opens. */
const AHEAD = 16;

const ReminderContext = createContext<Reminder | null>(null);

/** Keeps the payday reminders on this phone in step with the pay schedule. */
export function ReminderProvider({ children }: { children: ReactNode }) {
  const { ready, plan } = useStore();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setSettings({ ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) }))
      .catch(() => setSettings(DEFAULTS));
  }, []);

  const dates = ready ? nextPaydays(plan, AHEAD).join(",") : null;
  useEffect(() => {
    if (!canNotify || !settings || dates === null) return;
    (settings.on ? scheduleReminders(dates ? dates.split(",") : [], settings.hour) : cancelReminders()).catch(() => {});
  }, [settings, dates]);

  const update = async (patch: Partial<ReminderSettings>) => {
    const next = { ...(settings ?? DEFAULTS), ...patch };
    if (patch.on && canNotify && !(await askToNotify())) return "Notifications are off for this app. Turn them on in your phone's Settings, under Notifications, then try again.";
    setSettings(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return null;
  };

  return <ReminderContext.Provider value={{ settings: settings ?? DEFAULTS, update }}>{children}</ReminderContext.Provider>;
}

export function useReminder(): Reminder {
  const r = useContext(ReminderContext);
  if (!r) throw new Error("useReminder must be used inside ReminderProvider");
  return r;
}
