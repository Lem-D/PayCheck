import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import ReminderPanel from "../components/ReminderPanel";
import Screen from "../components/Screen";
import { Button, Cell, Grid, Muted, Note, NumberField, Ring, Section, T, Tile, Title } from "../components/ui";
import { accountName, allocate, fmtDate, logPayday, paydaysLeft, remaining } from "../lib/allocate";
import { cents, money } from "../lib/money";
import { isPaydayToday } from "../lib/paydays";
import { useStore } from "../lib/store";
import { font, tint, useColors } from "../theme";

const longDate = (t: number) => new Date(t).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });

export default function PaydayScreen() {
  const c = useColors();
  const { plan, setPlan, acc, setAcc } = useStore();
  const [pay, setPay] = useState(0);
  const [apply, setApply] = useState(true);
  const [armed, setArmed] = useState(false);
  const [logged, setLogged] = useState("");

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  const configured = plan.categories.length > 0 || plan.goals.length > 0;
  const r = allocate(pay, plan, acc.accounts);
  const keep = cents(r.spendTotal + r.unassigned);
  const savedPct = r.pay ? Math.round((r.saveTotal / r.pay) * 100) : 0;
  const history = plan.paydays.slice(-6).reverse();
  const show = configured && pay > 0;

  const notes: { kind: "warn" | "bad" | "good"; text: string }[] = [];
  if (r.shortSpend > 0) notes.push({ kind: "bad", text: `This cheque doesn't cover your spending limits. You're ${money(r.shortSpend)} short, so nothing goes to goals this time.` });
  else if (r.short)
    notes.push({
      kind: "warn",
      text: `Your dated goals need ${money(r.totalNeed)} this payday, but only ${money(r.saveTotal)} is left after spending, so each goal gets a share. To stay on track, push a goal's date back or lower a spending limit.`,
    });
  if (r.unassigned > 0) notes.push({ kind: "warn", text: `${money(r.unassigned)} has nowhere to go and stays in chequing. Pick where extra money goes on the Goals tab.` });

  const markDone = () => {
    if (!armed) return setArmed(true);
    setArmed(false);
    const next = logPayday(pay, plan, acc, apply);
    setPlan(next.plan);
    if (apply) setAcc(next.acc);
    setPay(0);
    setLogged(`Logged ${money(next.result.saveTotal)} saved from your ${money(next.result.pay)} paycheque.` + (apply ? " Your balances and goals are updated." : ""));
  };

  const row = (key: string, what: string, amt: number, sub?: string, color = c.ink) => (
    <View key={key} style={st.row}>
      <View style={st.rowTop}>
        <T style={{ flexShrink: 1 }}>{what}</T>
        <T w="semibold" color={color}>
          {money(amt)}
        </T>
      </View>
      {sub ? <Muted size={12}>{sub}</Muted> : null}
    </View>
  );

  return (
    <Screen>
      <Title pill={new Date().toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}>Payday</Title>

      {isPaydayToday(plan) && !pay && !logged ? <Note kind="good">It's payday. Type in what landed in your account to see where it goes.</Note> : null}

      <View style={st.ringWrap}>
        <Ring value={show ? savedPct : 0} size={236} stroke={18} color={c.accent} track={show && keep > 0 ? c.spend : c.track}>
          <View style={st.ringCenter}>
            <Muted size={13}>I got paid</Muted>
            <View style={st.payRow}>
              <T w="semibold" size={30} color={c.muted}>
                $
              </T>
              <NumberField
                accessibilityLabel="Amount you got paid"
                placeholder="0"
                value={pay}
                onValue={(n) => {
                  setPay(cents(n));
                  setLogged("");
                }}
                style={[font("semibold"), st.payField, { color: c.ink }]}
              />
            </View>
            {show ? (
              <T w="semibold" size={14} color={c.accent}>
                {savedPct}% saved
              </T>
            ) : (
              <Muted size={12}>Tap to type it in</Muted>
            )}
          </View>
        </Ring>
      </View>

      {!configured ? (
        <Tile>
          <T>Set your spending limits and savings goals first. Then every payday is just typing in the amount.</T>
          <Button kind="primary" title="Set up my goals" onPress={() => router.navigate("/goals")} />
        </Tile>
      ) : !pay ? (
        <Muted size={14} style={{ textAlign: "center" }}>
          {logged || "Type in what landed in your account and you'll see where every dollar goes."}
        </Muted>
      ) : null}

      {show && (
        <>
          <Grid>
            <Cell>
              <Tile bg={tint(c.spend, c.surface, 0.11)}>
                <Muted size={12}>Spend</Muted>
                <T w="semibold" size={22} color={c.spend}>
                  {money(keep)}
                </T>
              </Tile>
            </Cell>
            <Cell>
              <Tile bg={tint(c.accent, c.surface, 0.13)}>
                <Muted size={12}>Save</Muted>
                <T w="semibold" size={22} color={c.accent}>
                  {money(r.saveTotal)}
                </T>
              </Tile>
            </Cell>
          </Grid>

          {notes.map((n) => (
            <Note key={n.text} kind={n.kind}>
              {n.text}
            </Note>
          ))}

          <Tile>
            <Muted size={12}>Move now</Muted>
            {r.transfers.length ? (
              r.transfers.map((t) => (
                <View key={t.accountId} style={st.rowTop}>
                  <T>→ {t.name}</T>
                  <T w="semibold">{money(t.amount)}</T>
                </View>
              ))
            ) : (
              <Muted size={14}>No transfers this time. Everything stays in chequing.</Muted>
            )}
          </Tile>

          <Tile>
            <Muted size={12}>Toward your goals</Muted>
            {r.goals.length || r.extra ? (
              <>
                {r.goals.map((x) =>
                  row(
                    x.goal.id,
                    x.goal.name,
                    x.amount,
                    `${money(remaining(x.goal))} to go by ${fmtDate(x.goal.date)} · ${paydaysLeft(x.goal, plan)} paydays left · into ${accountName(acc.accounts, x.goal.accountId)}`,
                    c.accent,
                  ),
                )}
                {r.extra ? row("extra", `Extra to ${r.extra.label}`, r.extra.amount, "What's left after spending and goals", c.accent) : null}
              </>
            ) : (
              <Muted size={14}>No goals with a date yet. Add one on the Goals tab.</Muted>
            )}
          </Tile>

          <Tile>
            <Muted size={12}>Spending money this pay period</Muted>
            {r.spend.map((s, i) => row(`s${i}`, s.name, s.amount, s.short > 0 ? `${money(s.short)} short of your limit` : undefined, c.spend))}
            {r.unassigned > 0 ? row("unassigned", "Unassigned", r.unassigned) : null}
          </Tile>

          <View style={st.check}>
            <Switch value={apply} onValueChange={setApply} trackColor={{ true: c.accent, false: c.track }} thumbColor={c.surface} accessibilityLabel="Add these deposits to my account balances and goal progress" />
            <T size={14} style={{ flex: 1 }}>
              Add these deposits to my account balances and goal progress
            </T>
          </View>
          <Button kind="primary" title={armed ? "Tap again to confirm" : "I moved the money"} disabled={!(r.saveTotal > 0)} onPress={markDone} />
        </>
      )}

      {history.length > 0 && (
        <Section title="Past paydays">
          <Tile>
            {history.map((p) => (
              <View key={p.date} style={st.row}>
                <View style={st.rowTop}>
                  <T w="medium">{longDate(p.date)}</T>
                  <T w="semibold" color={c.accent}>
                    {money(p.saved)} saved
                  </T>
                </View>
                <Muted size={12}>
                  {money(p.pay)} paycheque · {money(p.spend)} for spending
                  {p.moves.length ? " · " + p.moves.map((m) => `${money(m.amount)} to ${m.name}`).join(", ") : ""}
                </Muted>
              </View>
            ))}
          </Tile>
        </Section>
      )}

      <ReminderPanel />
    </Screen>
  );
}

const st = StyleSheet.create({
  ringWrap: { alignItems: "center", paddingVertical: 4 },
  ringCenter: { alignItems: "center", gap: 2, width: 180 },
  payRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  payField: { fontSize: 38, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0, paddingVertical: 2, textAlign: "center", minWidth: 60, maxWidth: 150 },
  row: { gap: 1, paddingVertical: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  check: { flexDirection: "row", alignItems: "center", gap: 10 },
});
