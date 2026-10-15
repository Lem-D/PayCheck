import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import BackupPanel from "../components/BackupPanel";
import AccountEditor, { type ListName } from "../components/AccountEditor";
import Screen from "../components/Screen";
import { Bar, Button, Cell, Grid, Muted, Section, T, Tile, Title } from "../components/ui";
import { money, total } from "../lib/money";
import { useStore } from "../lib/store";
import { tint, useColors } from "../theme";
import type { Debt } from "../types";

const shortDate = (t: number) => new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

export default function AccountsScreen() {
  const c = useColors();
  const { acc, setAcc, setPlan } = useStore();
  const [editing, setEditing] = useState<{ list: ListName; id: string | null } | null>(null);
  const have = total(acc.accounts, (a) => a.balance);
  const owe = total(acc.debts, (d) => d.balance);
  const net = have - owe;
  const all = have + owe;

  const save = (list: ListName, item: Debt) => {
    setAcc((a) => ({
      ...a,
      [list]: a[list].some((x) => x.id === item.id) ? a[list].map((x) => (x.id === item.id ? item : x)) : [...a[list], item],
    }));
    setEditing(null);
  };

  const remove = (list: ListName, id: string) => {
    setAcc((a) => ({ ...a, [list]: a[list].filter((x) => x.id !== id) }));
    if (list === "accounts")
      // Goals saved there fall back to chequing, and leftover money stops going there.
      setPlan((p) => ({
        ...p,
        goals: p.goals.map((g) => (g.accountId === id ? { ...g, accountId: "" } : g)),
        extraTo: p.extraTo === `acct:${id}` ? "" : p.extraTo,
      }));
    setEditing(null);
  };

  const group = (list: ListName, title: string, sum: number, emptyText: string, addText: string) => {
    const items: Debt[] = acc[list];
    const isDebt = list === "debts";
    const current = editing?.list === list ? editing : null;
    const existing = current?.id ? items.find((x) => x.id === current.id) : undefined;
    const shown = items.filter((x) => x.id !== current?.id);
    return (
      <Section title={title} right={items.length ? money(sum) : undefined}>
        {current && (
          <AccountEditor
            key={current.id ?? "new"}
            list={list}
            existing={existing}
            onSave={(item) => save(list, item)}
            onCancel={() => setEditing(null)}
            onDelete={existing ? () => remove(list, existing.id) : undefined}
          />
        )}
        {!items.length ? (
          <Tile>
            <Muted size={14}>{emptyText}</Muted>
          </Tile>
        ) : shown.length ? (
          <Grid>
            {shown.map((x) => (
              <Cell key={x.id}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${x.name}`} onPress={() => setEditing({ list, id: x.id })} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]}>
                  <Tile style={[{ flex: 1, gap: 3 }, isDebt && { borderWidth: 1.5, borderColor: tint(c.bad, c.surface, 0.45) }]}>
                    <Muted size={12} numberOfLines={1}>
                      {isDebt && x.rate ? `${x.kind} · ${x.rate}%` : x.kind}
                    </Muted>
                    <T w="semibold" numberOfLines={1}>
                      {x.name}
                    </T>
                    <T w="semibold" size={18} color={isDebt ? c.bad : c.ink}>
                      {money(x.balance)}
                    </T>
                    <Muted size={11}>
                      {[isDebt && x.minPayment ? `${money(x.minPayment)} min` : "", x.updated ? `Updated ${shortDate(x.updated)}` : ""].filter(Boolean).join(" · ")}
                    </Muted>
                  </Tile>
                </Pressable>
              </Cell>
            ))}
          </Grid>
        ) : null}
        {!current && <Button kind="dashed" title={addText} onPress={() => setEditing({ list, id: null })} />}
      </Section>
    );
  };

  return (
    <Screen>
      <Title>Accounts</Title>
      <Tile style={{ gap: 10 }}>
        <Muted size={12}>Net worth</Muted>
        <T w="bold" size={38} color={net < 0 ? c.bad : c.good}>
          {net < 0 ? `−${money(-net)}` : money(net)}
        </T>
        <Bar
          height={8}
          parts={[
            { value: all ? (have / all) * 100 : 0, color: c.good },
            { value: all ? (owe / all) * 100 : 0, color: c.bad },
          ]}
        />
        <View style={st.split}>
          <View style={{ gap: 1 }}>
            <Muted size={12}>Have</Muted>
            <T w="semibold" size={16}>
              {money(have)}
            </T>
          </View>
          <View style={{ gap: 1, alignItems: "flex-end" }}>
            <Muted size={12}>Owe</Muted>
            <T w="semibold" size={16} color={c.bad}>
              {money(owe)}
            </T>
          </View>
        </View>
      </Tile>
      {group("accounts", "Accounts", have, "No accounts yet. Add your chequing, savings and TFSA with today's balances.", "+ Add account")}
      {group("debts", "What you owe", owe, "Nothing owed yet. Add credit cards, loans or money you owe someone.", "+ Add debt")}
      <BackupPanel />
    </Screen>
  );
}

const st = StyleSheet.create({
  split: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
});
