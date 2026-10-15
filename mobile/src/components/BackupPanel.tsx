import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { backupName, describe, makeBackup, readBackup, type BackupData, type BackupSummary } from "../lib/backup";
import { pickBackupFile, saveBackupFile } from "../lib/backupFile";
import { useStore } from "../lib/store";
import { useColors } from "../theme";
import { Button, Muted, Note, Section, T, Tile } from "./ui";

const LAST_KEY = "paycheque-plan-last-backup";
const DAY = 86_400_000;
const when = (t: number) => new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

/** Save everything to a file you keep somewhere safe, and restore it on this or another phone. */
export default function BackupPanel() {
  const c = useColors();
  const { acc, plan, spending, setAcc, setPlan, setSpending } = useStore();
  const [last, setLast] = useState<number | null>(null);
  const [pending, setPending] = useState<(BackupData & { summary: BackupSummary }) | null>(null);
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState<{ kind: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_KEY)
      .then((v) => setLast(v ? Number(v) : null))
      .catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const now = Date.now();
      if (!(await saveBackupFile(makeBackup({ acc, plan, spending }, now), backupName(now)))) return;
      await AsyncStorage.setItem(LAST_KEY, String(now));
      setLast(now);
    } catch {
      setMessage({ kind: "bad", text: "The backup couldn't be saved. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    setMessage(null);
    setArmed(false);
    try {
      const text = await pickBackupFile();
      if (text === null) return;
      const r = readBackup(text);
      if (r.ok) setPending(r);
      else setMessage({ kind: "bad", text: r.error });
    } catch {
      setMessage({ kind: "bad", text: "That file couldn't be opened. Try again." });
    }
  };

  const restore = () => {
    if (!pending) return;
    if (!armed) return setArmed(true);
    setAcc(pending.acc);
    setPlan(pending.plan);
    setSpending(pending.spending);
    setMessage({ kind: "good", text: `Restored ${describe(pending.summary)}.` });
    setPending(null);
    setArmed(false);
  };

  const stale = last === null || Date.now() - last > 30 * DAY;
  const hasData = acc.accounts.length + acc.debts.length + plan.goals.length + plan.paydays.length > 0;

  return (
    <Section title="Your data">
      <Tile style={{ gap: 10 }}>
        <T size={14}>Everything is saved on this device. Save a backup file to Files, iCloud Drive or email, so you can restore it on a new phone or after reinstalling.</T>
        <Muted size={13} style={hasData && stale ? { color: c.warn } : undefined}>
          {last ? `Last backup ${when(last)}` : "No backup yet"}
        </Muted>
        <View style={st.row}>
          <Button kind="primary" title={busy ? "Saving…" : "Save a backup"} disabled={busy} onPress={save} />
          <Button title="Restore from a backup" onPress={pick} />
        </View>
      </Tile>
      {pending && (
        <Tile style={{ gap: 10, borderWidth: 1.5, borderColor: c.bad }}>
          <T w="semibold">Restore this backup?</T>
          <Muted size={14}>
            {pending.summary.exportedAt ? `Saved ${when(pending.summary.exportedAt)}. ` : ""}
            It has {describe(pending.summary)}. It replaces everything in the app now.
          </Muted>
          <View style={st.row}>
            <Button kind={armed ? "dangerArmed" : "danger"} title={armed ? "Tap again to replace my data" : "Replace my data"} onPress={restore} />
            <Button
              kind="quiet"
              title="Cancel"
              onPress={() => {
                setPending(null);
                setArmed(false);
              }}
            />
          </View>
        </Tile>
      )}
      {message ? <Note kind={message.kind}>{message.text}</Note> : null}
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
});
