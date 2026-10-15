import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { toDate } from "../lib/paydays";
import { useColors } from "../theme";
import { Muted, T } from "./ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
/** "Wed, Jun 30, 2027" */
export const longDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

interface Props {
  /** "YYYY-MM-DD", or "" for none. */
  value: string;
  onChange: (date: string) => void;
  label: string;
  /** Shown when there's no date. */
  placeholder?: string;
  /** Days before this can't be picked. */
  min?: string;
  /** Quick picks under the calendar, like "In 6 months". */
  shortcuts?: { label: string; date: string }[];
  /** Offers a button to remove the date, with this label. */
  clearLabel?: string;
}

/** A date you pick from a calendar that opens under the field, instead of typing it. */
export default function DateField({ value, onChange, label, placeholder = "Pick a date", min, shortcuts, clearLabel }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const start = value || min || toDate();
  const [month, setMonth] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  const today = toDate();

  const toggle = () => {
    if (!open) setMonth({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
    setOpen(!open);
  };
  const pick = (d: string) => {
    onChange(d);
    setOpen(false);
  };
  const shift = (months: number) =>
    setMonth(({ y, m }) => {
      const t = new Date(y, m + months, 1);
      return { y: t.getFullYear(), m: t.getMonth() };
    });

  const first = new Date(month.y, month.m, 1).getDay();
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const title = new Date(month.y, month.m, 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  const canGoBack = !min || iso(month.y, month.m, 1) > min.slice(0, 8) + "01";

  const arrow = (name: "chevron-back" | "chevron-forward" | "play-back" | "play-forward", what: string, months: number, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={what} disabled={disabled} hitSlop={6} onPress={() => shift(months)} style={({ pressed }) => [st.arrow, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <Ionicons name={name} size={name.startsWith("play") ? 14 : 20} color={c.ink} />
    </Pressable>
  );

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? longDate(value) : placeholder}`}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [st.field, { backgroundColor: c.bg, borderColor: open ? c.accent : c.line, opacity: pressed ? 0.8 : 1 }]}
      >
        <Ionicons name="calendar-outline" size={18} color={value ? c.accent : c.muted} />
        <T style={{ flex: 1 }} color={value ? c.ink : c.muted}>
          {value ? longDate(value) : placeholder}
        </T>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={c.muted} />
      </Pressable>

      {open && (
        <View style={[st.calendar, { backgroundColor: c.bg, borderColor: c.line }]}>
          <View style={st.head}>
            {arrow("play-back", "Back a year", -12, !!min && iso(month.y - 1, month.m, 1) < min.slice(0, 8) + "01")}
            {arrow("chevron-back", "Back a month", -1, !canGoBack)}
            <T w="semibold" style={st.title} accessibilityRole="header">
              {title}
            </T>
            {arrow("chevron-forward", "Forward a month", 1)}
            {arrow("play-forward", "Forward a year", 12)}
          </View>
          <View style={st.week}>
            {WEEKDAYS.map((d, i) => (
              <Muted key={i} size={12} w="semibold" style={st.cellText}>
                {d}
              </Muted>
            ))}
          </View>
          {rows.map((row, r) => (
            <View key={r} style={st.week}>
              {row.map((d, i) => {
                if (d === null) return <View key={i} style={st.cell} />;
                const date = iso(month.y, month.m, d);
                const chosen = date === value;
                const off = !!min && date < min;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={longDate(date)}
                    accessibilityState={{ selected: chosen, disabled: off }}
                    disabled={off}
                    onPress={() => pick(date)}
                    style={st.cell}
                  >
                    {({ pressed }) => (
                      <View style={[st.day, chosen ? { backgroundColor: c.accent } : date === today ? { borderColor: c.accent, borderWidth: 1.5 } : pressed && { backgroundColor: c.track }]}>
                        <T w={chosen || date === today ? "semibold" : "regular"} size={15} color={chosen ? c.accentInk : off ? c.line : c.ink}>
                          {d}
                        </T>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {shortcuts?.length || (clearLabel && value) ? (
            <View style={[st.foot, { borderTopColor: c.line }]}>
              {shortcuts?.map((s) => (
                <Pressable key={s.label} accessibilityRole="button" onPress={() => pick(s.date)} style={({ pressed }) => [st.chip, { borderColor: c.line, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}>
                  <T size={13}>{s.label}</T>
                </Pressable>
              ))}
              {clearLabel && value ? (
                <Pressable accessibilityRole="button" onPress={() => pick("")} style={({ pressed }) => [st.chip, { borderColor: "transparent", opacity: pressed ? 0.7 : 1 }]}>
                  <T size={13} w="semibold" color={c.bad}>
                    {clearLabel}
                  </T>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12 },
  calendar: { borderWidth: 1, borderRadius: 14, padding: 8, gap: 2 },
  head: { flexDirection: "row", alignItems: "center", paddingBottom: 4 },
  title: { flex: 1, textAlign: "center" },
  arrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row" },
  cell: { flex: 1, height: 40, alignItems: "center", justifyContent: "center" },
  cellText: { flex: 1, textAlign: "center", paddingVertical: 4 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  foot: { flexDirection: "row", flexWrap: "wrap", gap: 6, borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
});
