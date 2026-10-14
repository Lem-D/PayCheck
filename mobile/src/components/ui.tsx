import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { num } from "../lib/money";
import { font, useColors, type Weight } from "../theme";

/** Text in the app font. */
export function T({ w = "regular", size = 15, color, style, ...rest }: TextProps & { w?: Weight; size?: number; color?: string }) {
  const c = useColors();
  return <Text {...rest} style={[font(w), { fontSize: size, color: color ?? c.ink }, style]} />;
}

export const Muted = ({ size = 13, ...rest }: TextProps & { size?: number; w?: Weight }) => {
  const c = useColors();
  return <T size={size} color={c.muted} {...rest} />;
};

/** Screen title with an optional pill on the right, like "9 days left". */
export function Title({ children, pill }: { children: ReactNode; pill?: string }) {
  return (
    <View style={styles.titleRow}>
      <T w="bold" size={26} accessibilityRole="header">
        {children}
      </T>
      {pill ? <Pill>{pill}</Pill> : null}
    </View>
  );
}

export function Pill({ children, color, bg }: { children: ReactNode; color?: string; bg?: string }) {
  const c = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: bg ?? c.track }]}>
      <T w="semibold" size={12} color={color ?? c.muted}>
        {children}
      </T>
    </View>
  );
}

export function Section({ title, right, children }: { title?: string; right?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHead}>
          <T w="semibold" size={17} accessibilityRole="header">
            {title}
          </T>
          {right ? <Muted>{right}</Muted> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** A rounded panel. Light mode gets a soft shadow; dark mode relies on the lighter surface. */
export function Tile({ children, style, bg }: { children: ReactNode; style?: StyleProp<ViewStyle>; bg?: string }) {
  const c = useColors();
  return <View style={[styles.tile, { backgroundColor: bg ?? c.surface }, c.shadow && styles.shadow, style]}>{children}</View>;
}

export const Grid = ({ children }: { children: ReactNode }) => <View style={styles.grid}>{children}</View>;
/** Half-width cell for Grid. */
export const Cell = ({ children }: { children: ReactNode }) => <View style={styles.cell}>{children}</View>;

/** A progress ring. `value` is 0 to 100. */
export function Ring({ value, size, stroke, color, track, children }: { value: number; size: number; stroke: number; color: string; track?: string; children?: ReactNode }) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, value));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? c.track} strokeWidth={stroke} />
        {p > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(circ * p) / 100} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

export function Bar({ parts, height = 6 }: { parts: { value: number; color: string }[]; height?: number }) {
  const c = useColors();
  return (
    <View style={[styles.bar, { backgroundColor: c.track, height, borderRadius: height }]}>
      {parts.map((p, i) => (
        <View key={i} style={{ width: `${Math.max(0, Math.min(100, p.value))}%`, backgroundColor: p.color }} />
      ))}
    </View>
  );
}

type ButtonKind = "default" | "primary" | "danger" | "dangerArmed" | "quiet" | "dashed";

export function Button({ title, onPress, kind = "default", disabled, full }: { title: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; full?: boolean }) {
  const c = useColors();
  const look: Record<ButtonKind, { bg: string; border: string; ink: string }> = {
    default: { bg: c.surface, border: c.line, ink: c.ink },
    primary: { bg: c.accent, border: c.accent, ink: c.accentInk },
    danger: { bg: "transparent", border: c.bad, ink: c.bad },
    dangerArmed: { bg: c.bad, border: c.bad, ink: c.surface },
    quiet: { bg: "transparent", border: "transparent", ink: c.muted },
    dashed: { bg: "transparent", border: c.line, ink: c.muted },
  };
  const l = look[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: l.bg, borderColor: l.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === "dashed" && { borderStyle: "dashed" },
        (full || kind === "primary" || kind === "dashed") && { alignSelf: "stretch", alignItems: "center" },
      ]}
    >
      <T w={kind === "primary" ? "bold" : "semibold"} size={15} color={l.ink}>
        {title}
      </T>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const c = useColors();
  return <TextInput placeholderTextColor={c.muted} {...props} style={[font("regular"), styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }, props.style]} />;
}

/** A decimal field that keeps what you typed (like "12.") while reporting the parsed number. */
export function NumberField({ value, onValue, ...rest }: Omit<TextInputProps, "value" | "onChangeText"> & { value: number | null | undefined; onValue: (n: number | null) => void }) {
  const shown = value === null || value === undefined || value === 0 ? "" : String(value);
  const [draft, setDraft] = useState(shown);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(shown);
  }, [shown, focused]);
  return (
    <Input
      keyboardType="decimal-pad"
      {...rest}
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChangeText={(t) => {
        const clean = t.replace(",", ".");
        setDraft(clean);
        onValue(clean === "" ? null : num(clean));
      }}
      style={[{ textAlign: "right" }, rest.style]}
    />
  );
}

/** A row of tappable options where one is selected. */
export function Choice<V extends string>({ options, value, onChange, label }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string }) {
  const c = useColors();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.chip, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface }]}
          >
            <T w={on ? "semibold" : "regular"} size={14} color={on ? c.accentInk : c.ink}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tinted message: warn, bad or good. */
export function Note({ kind, children }: { kind: "warn" | "bad" | "good"; children: ReactNode }) {
  const c = useColors();
  const color = kind === "bad" ? c.bad : kind === "warn" ? c.warn : c.good;
  return (
    <View style={[styles.note, { borderLeftColor: color, backgroundColor: c.surface }, c.shadow && styles.shadow]}>
      <T size={14} color={c.ink}>
        {children}
      </T>
    </View>
  );
}

export const screen = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 18, maxWidth: 640, width: "100%", alignSelf: "center" },
});

export const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  section: { gap: 10 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  tile: { borderRadius: 18, padding: 14, gap: 6 },
  shadow: { shadowColor: "#141928", shadowOpacity: 0.07, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { flexBasis: "47%", flexGrow: 1 },
  btn: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignSelf: "flex-start" },
  input: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  bar: { flexDirection: "row", overflow: "hidden" },
  note: { padding: 12, borderRadius: 12, borderLeftWidth: 4 },
});

export type { TextStyle };
