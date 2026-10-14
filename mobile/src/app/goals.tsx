import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import GoalEditor from "../components/GoalEditor";
import Screen from "../components/Screen";
import { Button, Choice, Input, Muted, NumberField, Ring, Section, T, Tile, Title } from "../components/ui";
import { accountName, fmtDate, perPaycheque, remaining } from "../lib/allocate";
import { cents, money, num, total, uid } from "../lib/money";
import { useStore } from "../lib/store";
import { useColors } from "../theme";
import { STARTER_CATEGORIES, type Category, type Frequency, type Goal } from "../types";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "monthly", label: "Once a month" },
];

export default function GoalsScreen() {
  const c = useColors();
  const { plan, setPlan, acc } = useStore();
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const existing = editing?.id ? plan.goals.find((g) => g.id === editing.id) : undefined;

  const saveGoal = (g: Goal) => {
    setPlan((p) => ({ ...p, goals: p.goals.some((x) => x.id === g.id) ? p.goals.map((x) => (x.id === g.id ? g : x)) : [...p.goals, g] }));
    setEditing(null);
  };
  const deleteGoal = (id: string) => {
    setPlan((p) => ({ ...p, goals: p.goals.filter((x) => x.id !== id), extraTo: p.extraTo === `goal:${id}` ? "" : p.extraTo }));
    setEditing(null);
  };
  const updateCategory = (id: string, patch: Partial<Category>) =>
    setPlan((p) => ({ ...p, categories: p.categories.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const extraOptions = [
    { value: "", label: "Keep it in chequing" },
    ...plan.goals.filter((g) => remaining(g) > 0).map((g) => ({ value: `goal:${g.id}`, label: g.name })),
    ...acc.accounts.map((a) => ({ value: `acct:${a.id}`, label: a.name })),
  ];
  const extraTo = extraOptions.some((o) => o.value === plan.extraTo) ? plan.extraTo : "";
  const shown = plan.goals.filter((g) => g.id !== editing?.id);

  const leftoverLabel = extraOptions.find((o) => o.value === extraTo)?.label ?? "Keep it in chequing";

  return (
    <Screen>
      <Title pill={plan.goals.length ? `${money(total(plan.goals, (g) => g.saved))} saved` : undefined}>Goals</Title>
      <Muted size={14}>Give each goal a target and a date. Each payday, the plan sets aside what it takes to get there on time.</Muted>

      {editing && (
        <GoalEditor
          key={editing.id ?? "new"}
          existing={existing}
          accounts={acc.accounts}
          onSave={saveGoal}
          onCancel={() => setEditing(null)}
          onDelete={existing ? () => deleteGoal(existing.id) : undefined}
        />
      )}
      {!plan.goals.length && !editing ? (
        <Tile>
          <Muted size={14}>No goals yet. Try an emergency fund, maxing your TFSA this year, or a trip.</Muted>
        </Tile>
      ) : null}
      {shown.map((g) => {
        const done = remaining(g) <= 0;
        const pct = num(g.target) ? Math.min(100, (num(g.saved) / num(g.target)) * 100) : 0;
        const per = perPaycheque(g, plan);
        return (
          <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`Edit ${g.name}`} onPress={() => setEditing({ id: g.id })} style={({ pressed }) => pressed && { opacity: 0.8 }}>
            <Tile style={st.goal}>
              <Ring value={pct} size={58} stroke={7} color={done ? c.good : c.accent}>
                <T w="semibold" size={13}>
                  {Math.round(pct)}%
                </T>
              </Ring>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T w="semibold" size={16} numberOfLines={1}>
                  {g.name}
                </T>
                <Muted>
                  {money(g.saved)} of {money(g.target)} · {accountName(acc.accounts, g.accountId)}
                </Muted>
                <T w="semibold" size={13} color={done ? c.good : g.date ? c.accent : c.muted}>
                  {done ? "Reached" : g.date ? `+${money(per)} per pay · by ${fmtDate(g.date)}` : "No date, gets leftover money if you pick it"}
                </T>
              </View>
            </Tile>
          </Pressable>
        );
      })}

      <Tile style={{ gap: 10 }}>
        <View style={st.leftHead}>
          <T w="semibold">Anything left over</T>
          <T w="semibold" color={c.accent} numberOfLines={1} style={{ flexShrink: 1 }}>
            → {leftoverLabel}
          </T>
        </View>
        <Muted>After spending and goals, extra money goes here.</Muted>
        <Choice label="Send leftover money to" options={extraOptions} value={extraTo} onChange={(v) => setPlan((p) => ({ ...p, extraTo: v }))} />
      </Tile>
      {!editing && <Button kind="dashed" title="+ New goal" onPress={() => setEditing({ id: null })} />}

      <Section title="Spending limits" right={plan.categories.length ? money(total(plan.categories, (x) => x.limit)) : undefined}>
        <Muted size={14}>What you allow yourself each pay period, bills included. This money stays in chequing.</Muted>
        <Tile style={{ gap: 8 }}>
          <Muted w="semibold">I get paid</Muted>
          <Choice label="I get paid" options={FREQUENCIES} value={plan.frequency} onChange={(f) => setPlan((p) => ({ ...p, frequency: f }))} />
        </Tile>
        {plan.categories.length > 0 && (
          <Tile style={{ gap: 0, paddingVertical: 6 }}>
            {plan.categories.map((cat, i) => (
              <View key={cat.id} style={[st.line, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <Input style={st.lineName} accessibilityLabel="Category name" value={cat.name} placeholder="Category" onChangeText={(t) => updateCategory(cat.id, { name: t })} />
                <NumberField style={st.lineAmt} accessibilityLabel={`Limit for ${cat.name || "this category"}`} placeholder="0.00" value={cat.limit} onValue={(n) => updateCategory(cat.id, { limit: cents(n) })} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${cat.name || "category"}`}
                  hitSlop={8}
                  onPress={() => setPlan((p) => ({ ...p, categories: p.categories.filter((x) => x.id !== cat.id) }))}
                  style={st.remove}
                >
                  <T size={20} color={c.muted}>
                    ×
                  </T>
                </Pressable>
              </View>
            ))}
          </Tile>
        )}
        <View style={st.btnRow}>
          <Button title="+ Add category" onPress={() => setPlan((p) => ({ ...p, categories: [...p.categories, { id: uid(), name: "", limit: 0 }] }))} />
          {!plan.categories.length && (
            <Button kind="quiet" title="Start with common categories" onPress={() => setPlan((p) => ({ ...p, categories: STARTER_CATEGORIES.map((name) => ({ id: uid(), name, limit: 0 })) }))} />
          )}
        </View>
      </Section>
    </Screen>
  );
}

const st = StyleSheet.create({
  goal: { flexDirection: "row", alignItems: "center", gap: 14 },
  leftHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  line: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  lineName: { flex: 1, minWidth: 0 },
  lineAmt: { width: 110, flexGrow: 0 },
  remove: { width: 32, height: 36, alignItems: "center", justifyContent: "center" },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
