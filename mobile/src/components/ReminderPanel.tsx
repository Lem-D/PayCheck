import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { canNotify, saveCalendar } from "../lib/notify";
import { nextPaydays, payAnchor, paydayCalendar, shortDay, toDate } from "../lib/paydays";
import { useReminder } from "../lib/reminder";
import { useStore } from "../lib/store";
import { useColors } from "../theme";
import type { Frequency } from "../types";
import DateField from "./DateField";
import { Button, Choice, Muted, Note, Section, T, Tile } from "./ui";

const HOURS = [
  { value: "7", label: "7 AM" },
  { value: "9", label: "9 AM" },
  { value: "12", label: "Noon" },
  { value: "17", label: "5 PM" },
];
const hourLabel = (h: number) => HOURS.find((o) => o.value === String(h))?.label ?? `${h}:00`;

const PAID: Record<Frequency, string> = { weekly: "every week", biweekly: "every 2 weeks", semimonthly: "twice a month", monthly: "once a month" };

/** The next payday, and a reminder on each one: a notification on the phone, or calendar alerts in the home screen app. */
export default function ReminderPanel() {
  const c = useColors();
  const { plan, setPlan } = useStore();
  const { settings, update } = useReminder();
  const [message, setMessage] = useState<{ kind: "good" | "bad"; text: string } | null>(null);
  const upcoming = nextPaydays(plan, 4);
  const anchor = payAnchor(plan);

  const toggle = async (on: boolean) => {
    setMessage(null);
    const err = await update({ on });
    if (err) setMessage({ kind: "bad", text: err });
  };
  const addToCalendar = async () => {
    setMessage(null);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    try {
      await saveCalendar(paydayCalendar(anchor, plan.frequency, settings.hour, toDate(), stamp));
      setMessage({ kind: "good", text: `Add them to your calendar when it asks. Each payday gets an alert at ${hourLabel(settings.hour)}. If your pay schedule changes, delete those events and add them again.` });
    } catch {
      setMessage({ kind: "bad", text: "Couldn't make the calendar file. Try again." });
    }
  };

  return (
    <Section title="Payday reminder">
      <Tile style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Muted w="semibold">Next payday</Muted>
          <DateField label="Next payday" value={upcoming[0] ?? ""} onChange={(d) => setPlan((p) => ({ ...p, nextPayday: d }))} placeholder="Pick your next payday" min={toDate()} />
          <Muted size={12}>
            {upcoming.length > 1
              ? `You're paid ${PAID[plan.frequency]}, so the ones after are ${upcoming.slice(1).map(shortDay).join(" · ")}. Change how often on the Goals tab.`
              : `You're paid ${PAID[plan.frequency]}. Change how often on the Goals tab.`}
          </Muted>
        </View>

        {canNotify ? (
          <>
            <View style={st.row}>
              <T style={{ flex: 1 }}>Remind me on payday</T>
              <Switch
                value={settings.on}
                disabled={!anchor}
                onValueChange={toggle}
                trackColor={{ true: c.accent, false: c.track }}
                thumbColor={c.surface}
                accessibilityLabel="Remind me on payday"
              />
            </View>
            {settings.on && (
              <View style={{ gap: 6 }}>
                <Muted w="semibold">At</Muted>
                <Choice label="Reminder time" options={HOURS} value={String(settings.hour)} onChange={(h) => update({ hour: Number(h) })} />
              </View>
            )}
            <Muted size={12}>{anchor ? (settings.on ? `You'll get a notification at ${hourLabel(settings.hour)} each payday.` : "Get a notification on this phone each payday.") : "Pick your next payday first."}</Muted>
          </>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <Muted w="semibold">Alert at</Muted>
              <Choice label="Alert time" options={HOURS} value={String(settings.hour)} onChange={(h) => update({ hour: Number(h) })} />
            </View>
            <Button title="Add paydays to my calendar" disabled={!anchor} onPress={addToCalendar} />
            <Muted size={12}>
              {anchor
                ? "The home screen app can't send notifications, so this puts your paydays in your phone's calendar with an alert, and they repeat on their own."
                : "Pick your next payday first."}
            </Muted>
          </>
        )}
        {message ? <Note kind={message.kind}>{message.text}</Note> : null}
      </Tile>
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
