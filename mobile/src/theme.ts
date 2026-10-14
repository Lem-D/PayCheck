import { useColorScheme, type TextStyle } from "react-native";

// Harbour Gold: gold means saving (rings, goals, the main button), sky blue means spending.
const light = {
  bg: "#f2f5fa",
  surface: "#ffffff",
  ink: "#13203a",
  muted: "#5f6b82",
  line: "#dfe5ef",
  track: "#e3e9f2",
  accent: "#c48410",
  accentInk: "#1b1405",
  spend: "#2f6fd6",
  good: "#1f9a6c",
  bad: "#d24a3c",
  warn: "#c27a00",
  shadow: true,
};

const dark: typeof light = {
  bg: "#0e1626",
  surface: "#152036",
  ink: "#eef2f8",
  muted: "#8e9ab0",
  line: "#24314b",
  track: "#24314b",
  accent: "#f2bf4b",
  accentInk: "#1b1405",
  spend: "#6fb6ff",
  good: "#5fd3a5",
  bad: "#ff7a6b",
  warn: "#f2bf4b",
  shadow: false,
};

export type Colors = typeof light;
export const useColors = (): Colors => (useColorScheme() === "dark" ? dark : light);

/** Mixes a colour into the surface, like CSS color-mix, for tinted tiles. `hex` and `base` are #rrggbb. */
export function tint(hex: string, base: string, amount: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = (i: number) => Math.round(p(hex, i) * amount + p(base, i) * (1 - amount)).toString(16).padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

// Outfit, loaded in _layout.tsx. Each weight is its own font file, so pick the family rather than fontWeight.
export const FONTS = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
} as const;
export type Weight = keyof typeof FONTS;
export const font = (w: Weight = "regular"): TextStyle => ({ fontFamily: FONTS[w], fontVariant: ["tabular-nums"] });
