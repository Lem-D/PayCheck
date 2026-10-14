import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Screen from "../components/Screen";
import { Bar, Button, Cell, Choice, Grid, Input, Muted, NumberField, Ring, Section, T, Tile, Title } from "../components/ui";
import { cents, money, uid } from "../lib/money";
import { addPurchase, categoryStatus, currentPeriod, inPeriod, periodTotals, type Level } from "../lib/spending";
import { useStore } from "../lib/store";
import { font, useColors, type Colors } from "../theme";

const levelColor = (c: Colors, l: Level) => (l === "over" ? c.bad : l === "warn" ? c.warn : c.spend);
const shortDate = (t: number) => new Date(t).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
const time = (t: number) => new Date(t).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

export default function SpendingScreen() {
  const c = useColors();
  const { plan, spending, setSpending } = useStore();
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");
  const [armedId, setArmedId] = useState<string | null>(null);

  const period = currentPeriod(plan);
  const status = categoryStatus(plan, spending.purchases, period);
  const totals = periodTotals(plan, spending.purchases, period);
  const recent = inPeriod(spending.purchases, period);
  const names = new Map(plan.categories.map((x) => [x.id, x.name || "Unnamed"]));
  const selected = plan.categories.some((x) => x.id === categoryId) ? categoryId : "";
  const pill = period.daysLeft === null ? undefined : period.daysLeft === 0 ? "Payday is due" : `${period.daysLeft} ${period.daysLeft === 1 ? "day" : "days"} left`;

  const add = () => {
    if (!(amount > 0)) return setError("Enter what you spent, like 24.50.");
    if (!selected) return setError("Pick which limit this comes out of.");
    setSpending((s) => ({ purchases: addPurchase(s.purchases, { id: uid(), categoryId: selected, amount: cents(amount), note: note.trim(), at: Date.now() }) }));
    const st = status.find((x) => x.category.id === selected);
    const left = st ? cents(st.left - amount) : 0;
    setAdded(`${money(amount)} on ${names.get(selected)}. ${left >= 0 ? `${money(left)} left` : `${money(-left)} over`} until payday.`);
    setAmount(0);
    setNote("");
    setError("");
  };

  const remove = (id: string) => {
    if (armedId !== id) return setArmedId(id);
    setSpending((s) => ({ purchases: s.purchases.filter((p) => p.id !== id) }));
    setArmedId(null);
  };

  if (!plan.categories.length)
    return (
      <Screen>
        <Title>This pay period</Title>
        <Tile>
          <T>Set your spending limits first, then log what you spend here and see what's left until payday.</T>
          <Button kind="primary" title="Set spending limits" onPress={() => router.navigate("/goals")} />
        </Tile>
      </Screen>
    );

  return (
    <Screen>
      <Title pill={pill}>This pay period</Title>

      <Tile style={st.hero}>
        <View style={{ flex: 1, gap: 2 }}>
          <Muted size={12}>Left to spend</Muted>
          <T w="semibold" size={32} color={totals.left < 0 ? c.bad : c.ink}>
            {totals.left < 0 ? `−${money(-totals.left)}` : money(totals.left)}
          </T>
          <Muted size={12}>
            {money(totals.spent)} of {money(totals.limit)}
            {period.start === null ? " · counts from your next logged payday" : ` since ${shortDate(period.start)}`}
          </Muted>
        </View>
        <Ring value={totals.limit ? (totals.spent / totals.limit) * 100 : 0} size={64} stroke={8} color={levelColor(c, totals.level)} />
      </Tile>

      <Tile style={{ gap: 12 }}>
        <Muted size={12}>Log a purchase</Muted>
        <View style={[st.amountRow, { borderBottomColor: c.line }]}>
          <T w="semibold" size={26} color={c.muted}>
            $
          </T>
          <NumberField
            accessibilityLabel="Amount spent"
            placeholder="0.00"
            value={amount}
            onValue={(n) => {
              setAmount(cents(n));
              setAdded("");
            }}
            style={[font("semibold"), st.amountField, { color: c.ink }]}
          />
        </View>
        <Choice label="Which limit" options={plan.categories.map((x) => ({ value: x.id, label: x.name || "Unnamed" }))} value={selected} onChange={setCategoryId} />
        <Input value={note} onChangeText={setNote} placeholder="Note (optional), e.g. Costco" accessibilityLabel="Note" returnKeyType="done" onSubmitEditing={add} />
        {error ? (
          <T size={14} color={c.bad} accessibilityRole="alert">
            {error}
          </T>
        ) : null}
        <Button kind="primary" title="Add purchase" onPress={add} />
        {added ? (
          <Muted size={13} accessibilityLiveRegion="polite">
            {added}
          </Muted>
        ) : null}
      </Tile>

      <Grid>
        {status.map((s) => {
          const color = levelColor(c, s.level);
          return (
            <Cell key={s.category.id}>
              <Tile style={{ gap: 6 }}>
                <Muted size={13} numberOfLines={1}>
                  {s.category.name || "Unnamed"}
                </Muted>
                <T w="semibold" size={18} color={s.level === "ok" ? c.ink : color}>
                  {s.left < 0 ? `−${money(-s.left)}` : money(s.left)}
                </T>
                <Bar height={5} parts={[{ value: s.used * 100, color }]} />
                <Muted size={11}>
                  {money(s.spent)} of {money(s.category.limit)}
                </Muted>
              </Tile>
            </Cell>
          );
        })}
      </Grid>
      {totals.other > 0 ? <Muted>{money(totals.other)} was spent in categories you've since removed.</Muted> : null}

      <Section title="Purchases">
        <Tile style={{ gap: 0, paddingVertical: 6 }}>
          {recent.length ? (
            recent.map((p, i) => (
              <View key={p.id} style={[st.buy, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w="medium">{p.note || names.get(p.categoryId) || "Removed category"}</T>
                  <Muted size={12}>
                    {p.note ? `${names.get(p.categoryId) ?? "Removed category"} · ` : ""}
                    {shortDate(p.at)}, {time(p.at)}
                  </Muted>
                </View>
                <T w="semibold" color={c.spend}>
                  {money(p.amount)}
                </T>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={armedId === p.id ? "Tap again to delete this purchase" : `Delete ${money(p.amount)} purchase`}
                  hitSlop={8}
                  onPress={() => remove(p.id)}
                  style={[st.remove, armedId === p.id && { backgroundColor: c.bad }]}
                >
                  <T w="semibold" size={armedId === p.id ? 12 : 18} color={armedId === p.id ? c.surface : c.muted}>
                    {armedId === p.id ? "Delete" : "×"}
                  </T>
                </Pressable>
              </View>
            ))
          ) : (
            <Muted size={14} style={{ paddingVertical: 8 }}>
              Nothing logged yet this pay period.
            </Muted>
          )}
        </Tile>
      </Section>
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 12 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 4, borderBottomWidth: 2, paddingBottom: 2 },
  amountField: { flex: 1, minWidth: 0, fontSize: 30, borderWidth: 0, backgroundColor: "transparent", textAlign: "left", paddingHorizontal: 0 },
  buy: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  remove: { minWidth: 34, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});
