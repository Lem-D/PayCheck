import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Expo Go and the installed app can schedule reminders on the phone itself. */
export const canNotify = true;

// Show the reminder even when PayCheck is open at the time.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const CHANNEL = "paydays";
const TAG = "payday";

/** Asks to send notifications if it hasn't been answered yet. Resolves whether they're allowed. */
export async function askToNotify(): Promise<boolean> {
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replaces the scheduled payday reminders with one at `hour` on each of these "YYYY-MM-DD" dates still ahead. */
export async function scheduleReminders(dates: string[], hour: number): Promise<void> {
  await cancelReminders();
  if (!dates.length || !(await Notifications.getPermissionsAsync()).granted) return;
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Payday reminders", importance: Notifications.AndroidImportance.DEFAULT });
  const now = Date.now();
  for (const d of dates) {
    const [y, m, day] = d.split("-").map(Number);
    const at = new Date(y, m - 1, day, hour, 0, 0);
    if (at.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: "It's payday", body: "Type in what you got paid and PayCheck shows where every dollar goes.", data: { kind: TAG } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

export async function cancelReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.content.data?.kind === TAG).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/** Calendar files are only offered in the browser version, which can't send notifications. */
export async function saveCalendar(_ics: string): Promise<boolean> {
  return false;
}
