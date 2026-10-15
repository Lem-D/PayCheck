import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Screen from "../components/Screen";
import { Bar, Button, Cell, Grid, Muted, Note, Pill, Ring, Section, T, Tile, Title } from "../components/ui";
import { fmtDate } from "../lib/allocate";
import { periods, summarize, trackGoals, type GoalTrack } from "../lib/history";
import { money, num } from "../lib/money";
import { useStore } from "../lib/store";
import { tint, useColors, type Colors } from "../theme";

const DAY = 86_400_000;
const short = (t: number) => new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
const monthYear = (t: number) => new Date(t).toLocaleDateString("en-CA", { month: "short", year: "numeric" });
const pct = (x: number) => `${Math.round(x * 100)}%`;

const STATUS: Record<GoalTrack["status"], { label: string; tone: "good" | "bad" | "muted" }> = {
  reached: { label: "Reached", tone: "good" },
  "on-track": { label: "On track", tone: "good" },
  behind: { label: "Behind", tone: "bad" },
  new: { label: "Just started", tone: "muted" },
  "no-date": { label: "No date", tone: "muted" },
};

function GoalLine({ t, c }: { t: GoalTrack; c: Colors }) {
  const { goal, status, need, getting, finish } = t;
  const progress = num(goal.target) ? (num(goal.saved) / num(goal.target)) * 100 : 0;
  const tone = STATUS[status].tone;
  const color = tone === "good" ? c.good : tone === "bad" ? c.bad : c.muted;
  let detail = "";
  if (status === "reached") detail = `${money(goal.target)} saved`;
  else if (status === "new") detail = need ? `Needs ${money(need)} per pay. Its pace shows after your next payday.` : "Its pace shows after your next payday.";
  else if (status === "no-date") detail = `Getting ${money(getting ?? 0)} per pay${finish ? ` · at this pace, ${monthYear(finish)}` : ""}`;
  else detail = `Needs ${money(need ?? 0)} per pay · getting ${money(getting ?? 0)}`;
  const when = goal.date && status !== "reached" ? `Due ${fmtDate(goal.date)}${finish && status === "behind" ? ` · at this pace, ${monthYear(finish)}` : ""}` : "";
  return (
    <Tile style={{ gap: 6 }}>
      <View style={st.head}>
        <T w="semibold" size={16} numberOfLines={1} style={{ flexShrink: 1 }}>
          {goal.name}
        </T>
        <Pill color={color} bg={tone === "muted" ? c.track : tint(color, c.surface, 0.16)}>
          {STATUS[status].label}
        </Pill>
      </View>
      <Bar height={5} parts={[{ value: progress, color: status === "reached" ? c.good : c.accent }]} />
      <Muted>{detail}</Muted>
      {when ? <Muted size={12}>{when}</Muted> : null}
    </Tile>
  );
}

export default function HistoryScreen() {
  const c = useColors();
  const { plan, spending } = useStore();
  const records = periods(plan, spending.purchases);
  const s = summarize(records);
  const goals = trackGoals(plan);

  if (!records.length)
    return (
      <Screen>
        <Title>History</Title>
        <Tile style={{ gap: 12 }}>
          <T>Each payday you log starts a pay period. When one ends, this shows whether you kept each spending limit and how much you saved, and how your goals are pacing.</T>
          <Button kind="primary" title="Go to Payday" onPress={() => router.navigate("/")} />
        </Tile>
      </Screen>
    );

  return (
    <Screen>
      <Title pill={s.periods ? `${s.periods} pay ${s.periods === 1 ? "period" : "periods"}` : undefined}>History</Title>

      {s.periods ? (
        <>
          <Tile style={st.hero}>
            <Ring value={s.limits ? (s.kept / s.limits) * 100 : 0} size={92} stroke={10} color={c.good}>
              <T w="semibold" size={18}>
                {s.limits ? pct(s.kept / s.limits) : "–"}
              </T>
            </Ring>
            <View style={{ flex: 1, gap: 3 }}>
              <T w="semibold" size={16}>
                Limits kept
              </T>
              <Muted>
                {s.kept} of {s.limits} across {s.periods} finished pay {s.periods === 1 ? "period" : "periods"}
              </Muted>
              {s.streak ? (
                <T w="semibold" size={13} color={c.accent}>
                  {s.streak} in a row with every limit kept
                </T>
              ) : null}
            </View>
          </Tile>
          <Grid>
            <Cell>
              <Tile bg={tint(c.accent, c.surface, 0.13)}>
                <Muted size={12}>Saved</Muted>
                <T w="semibold" size={20} color={c.accent}>
                  {money(s.saved)}
                </T>
              </Tile>
            </Cell>
            <Cell>
              <Tile>
                <Muted size={12}>Per payday</Muted>
                <T w="semibold" size={20}>
                  {money(s.avgSaved)}
                </T>
                <Muted size={11}>{pct(s.avgRate)} of pay</Muted>
              </Tile>
            </Cell>
          </Grid>
        </>
      ) : (
        <Note kind="good">Your first pay period is still running. It's added here when you log your next payday.</Note>
      )}

      {goals.length > 0 && (
        <Section title="Goals">
          {goals.map((t) => (
            <GoalLine key={t.goal.id} t={t} c={c} />
          ))}
        </Section>
      )}

      {s.categories.length > 0 && (
        <Section title="Spending limits" right="Latest on the right">
          <Grid>
            {s.categories.map((h) => (
              <Cell key={h.id}>
                <Tile style={{ gap: 6 }}>
                  <Muted size={13} numberOfLines={1}>
                    {h.name}
                  </Muted>
                  <T w="semibold" size={16} color={h.kept === h.of ? c.good : c.ink}>
                    Kept {h.kept} of {h.of}
                  </T>
                  <View style={st.dots} accessibilityLabel={h.marks.map((k) => (k ? "kept" : "over")).join(", ")}>
                    {h.marks.map((k, i) => (
                      <View key={i} style={[st.dot, { backgroundColor: k ? c.good : c.bad }]} />
                    ))}
                  </View>
                </Tile>
              </Cell>
            ))}
          </Grid>
        </Section>
      )}

      <Section title="Pay periods">
        {records.map((r) => {
          const over = r.limits.filter((l) => !l.kept);
          return (
            <Tile key={r.start} style={{ gap: 4 }}>
              <View style={st.head}>
                <View style={st.dates}>
                  <T w="semibold">
                    {short(r.start)} – {r.open ? "now" : short(Math.max(r.start, r.end - DAY))}
                  </T>
                  {r.open ? <Pill>So far</Pill> : null}
                </View>
                <T w="semibold" color={c.accent}>
                  {money(r.saved)} saved
                </T>
              </View>
              <Muted size={12}>
                {money(r.pay)} pay · {pct(r.rate)} saved · {money(r.spent)} spent of {money(r.limitTotal)}
              </Muted>
              {r.limits.length ? (
                <T size={14} w="medium" color={over.length ? (r.open ? c.warn : c.bad) : c.good}>
                  {over.length ? `Kept ${r.kept} of ${r.limits.length} limits` : `Kept all ${r.limits.length} limits${r.open ? " so far" : ""}`}
                </T>
              ) : null}
              {over.map((l) => (
                <Muted key={l.id} size={13}>
                  {l.name} over by {money(l.over)}
                </Muted>
              ))}
              {r.other > 0 ? <Muted size={12}>{money(r.other)} in categories that weren't limits then</Muted> : null}
              {r.todaysLimits ? <Muted size={12}>Logged before limits were saved with each payday, so today's limits are used.</Muted> : null}
            </Tile>
          );
        })}
      </Section>
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 16 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  dates: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  dots: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
