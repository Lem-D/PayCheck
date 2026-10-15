import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { cents, num, uid } from "../lib/money";
import { addMonths, toDate } from "../lib/paydays";
import { font, useColors } from "../theme";
import type { Account, Goal } from "../types";
import DateField from "./DateField";
import { Button, Choice, Input, Muted, T, Tile } from "./ui";

interface Props {
  existing?: Goal;
  accounts: Account[];
  onSave: (g: Goal) => void;
  onCancel: () => void;
  onDelete?: () => void;
}


/** Quick picks for a goal's date: a few months out, a year out, or the end of the year. */
function shortcuts() {
  const today = toDate();
  const yearEnd = `${today.slice(0, 4)}-12-31`;
  return [
    { label: "3 months", date: addMonths(today, 3) },
    { label: "6 months", date: addMonths(today, 6) },
    { label: "1 year", date: addMonths(today, 12) },
    { label: "End of this year", date: yearEnd },
  ];
}

export default function GoalEditor({ existing, accounts, onSave, onCancel, onDelete }: Props) {
  const c = useColors();
  const firstSaving = accounts.find((a) => a.kind !== "Chequing") ?? accounts[0];
  const [name, setName] = useState(existing?.name ?? "");
  const [target, setTarget] = useState(existing ? String(existing.target) : "");
  const [saved, setSaved] = useState(existing?.saved ? String(existing.saved) : "");
  const [date, setDate] = useState(existing?.date ?? "");
  const [accountId, setAccountId] = useState(existing?.accountId ?? firstSaving?.id ?? "");
  const [error, setError] = useState("");
  const [armed, setArmed] = useState(false);

  const submit = () => {
    const n = name.trim();
    const t = parseFloat(target.replace(",", "."));
    const d = date;
    if (!n) return setError("Give the goal a name, like Emergency fund.");
    if (!Number.isFinite(t) || t <= 0) return setError("Enter a target amount, like 5000.");
    if (d && d < toDate()) return setError("Pick a date that hasn't passed yet, or remove the date.");
    onSave({ id: existing?.id ?? uid(), name: n, accountId, target: cents(t), saved: cents(num(saved.replace(",", "."))), date: d });
  };

  const field = (label: string, child: ReactNode, hint?: string) => (
    <View style={s.field}>
      <Muted w="semibold">{label}</Muted>
      {child}
      {hint ? <Muted size={12}>{hint}</Muted> : null}
    </View>
  );

  return (
    <Tile style={[s.form, { borderColor: c.accent }]}>
      <T w="semibold" size={17}>
        {existing ? `Edit ${existing.name}` : "New goal"}
      </T>
      {field("Goal", <Input value={name} onChangeText={setName} placeholder="e.g. Emergency fund, Max my TFSA" autoFocus={!existing} accessibilityLabel="Goal name" />)}
      <View style={s.row}>
        <View style={s.half}>{field("Target ($)", <Input value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="5000" style={font()} accessibilityLabel="Target" />)}</View>
        <View style={s.half}>{field("Saved so far ($)", <Input value={saved} onChangeText={setSaved} keyboardType="decimal-pad" placeholder="0" style={font()} accessibilityLabel="Saved so far" />)}</View>
      </View>
      {field(
        "Reach it by",
        <DateField label="Reach it by" value={date} onChange={setDate} placeholder="No date" min={toDate()} shortcuts={shortcuts()} clearLabel="Remove date" />,
        "Optional. Without a date, the goal only gets leftover money.",
      )}
      {field(
        "Save it in",
        accounts.length ? (
          <Choice label="Save it in" options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
        ) : (
          <Muted size={14}>Chequing. Add accounts on the Accounts tab to pick one.</Muted>
        ),
      )}
      {error ? (
        <T size={14} color={c.bad} accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <View style={s.actions}>
        <Button title="Save goal" kind="primary" onPress={submit} />
        <Button title="Cancel" onPress={onCancel} />
        <View style={{ flex: 1 }} />
        {onDelete && <Button title={armed ? "Tap again to delete" : "Delete"} kind={armed ? "dangerArmed" : "danger"} onPress={() => (armed ? onDelete() : setArmed(true))} />}
      </View>
    </Tile>
  );
}

const s = StyleSheet.create({
  form: { borderWidth: 1.5, padding: 16, gap: 14 },
  field: { gap: 4 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
});
