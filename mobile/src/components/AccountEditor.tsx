import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { cents, uid } from "../lib/money";
import { font, useColors } from "../theme";
import { ACCOUNT_KINDS, DEBT_KINDS, type Debt } from "../types";
import { Button, Choice, Input, Muted, T, Tile } from "./ui";

export type ListName = "accounts" | "debts";

interface Props {
  list: ListName;
  existing?: Debt;
  onSave: (item: Debt) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function AccountEditor({ list, existing, onSave, onCancel, onDelete }: Props) {
  const c = useColors();
  const isDebt = list === "debts";
  const kinds: readonly string[] = isDebt ? DEBT_KINDS : ACCOUNT_KINDS;
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState(existing?.kind ?? kinds[0]);
  const [balance, setBalance] = useState(existing ? String(existing.balance) : "");
  const [rate, setRate] = useState(existing?.rate != null ? String(existing.rate) : "");
  const [minPayment, setMinPayment] = useState(existing?.minPayment != null ? String(existing.minPayment) : "");
  const [error, setError] = useState("");
  const [armed, setArmed] = useState(false);

  const submit = () => {
    const n = name.trim();
    const b = parseFloat(balance.replace(",", "."));
    if (!n) return setError("Give it a name so you can tell it apart.");
    if (!Number.isFinite(b) || b < 0) return setError("Enter the balance as a number, like 1250.00.");
    const item: Debt = { id: existing?.id ?? uid(), name: n, kind, balance: cents(b), updated: Date.now() };
    if (isDebt) {
      const r = parseFloat(rate.replace(",", "."));
      const m = parseFloat(minPayment.replace(",", "."));
      if (Number.isFinite(r)) item.rate = r;
      if (Number.isFinite(m)) item.minPayment = cents(m);
    }
    onSave(item);
  };

  return (
    <Tile style={[s.form, { borderColor: c.accent }]}>
      <T w="semibold" size={17}>
        {existing ? `Edit ${existing.name}` : isDebt ? "New debt" : "New account"}
      </T>
      <View style={s.field}>
        <Muted w="semibold">Name</Muted>
        <Input value={name} onChangeText={setName} placeholder={isDebt ? "e.g. Visa card" : "e.g. EQ Bank TFSA"} autoFocus={!existing} accessibilityLabel="Name" />
      </View>
      <View style={s.field}>
        <Muted w="semibold">Type</Muted>
        <Choice label="Type" options={kinds.map((k) => ({ value: k, label: k }))} value={kind} onChange={setKind} />
      </View>
      <View style={s.field}>
        <Muted w="semibold">{isDebt ? "Amount owed ($)" : "Balance ($)"}</Muted>
        <Input value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="0.00" style={font()} accessibilityLabel={isDebt ? "Amount owed" : "Balance"} />
      </View>
      {isDebt && (
        <View style={s.row}>
          <View style={[s.field, s.half]}>
            <Muted w="semibold">Interest rate (%)</Muted>
            <Input value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="Optional" style={font()} accessibilityLabel="Interest rate" />
          </View>
          <View style={[s.field, s.half]}>
            <Muted w="semibold">Minimum payment ($)</Muted>
            <Input value={minPayment} onChangeText={setMinPayment} keyboardType="decimal-pad" placeholder="Optional" style={font()} accessibilityLabel="Minimum payment" />
          </View>
        </View>
      )}
      {error ? (
        <T size={14} color={c.bad} accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <View style={s.actions}>
        <Button title="Save" kind="primary" onPress={submit} />
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
