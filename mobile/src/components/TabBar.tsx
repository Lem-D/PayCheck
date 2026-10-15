import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MaterialTopTabBarProps } from "expo-router/js-top-tabs";
import { useColors } from "../theme";
import { T } from "./ui";

type IconName = ComponentProps<typeof Ionicons>["name"];
const ICONS: Record<string, IconName> = {
  index: "cash-outline",
  spending: "cart-outline",
  goals: "flag-outline",
  accounts: "wallet-outline",
  history: "stats-chart-outline",
};

/** The floating rounded tab bar at the bottom. Tabs can also be changed by swiping the screen sideways. */
export default function TabBar({ state, descriptors, navigation, position }: MaterialTopTabBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.bar, { backgroundColor: c.surface, marginBottom: Math.max(12, insets.bottom) }, c.shadow && st.shadow]} accessibilityRole="tablist">
      {state.routes.map((route: { key: string; name: string }, i: number) => {
        const focused = state.index === i;
        const title = descriptors[route.key].options.title ?? route.name;
        const icon = ICONS[route.name] ?? "ellipse-outline";
        // The gold copy fades in as the page slides toward this tab, so the bar follows a swipe as it happens.
        const lit = position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0, 1, 0], extrapolate: "clamp" });
        const onPress = () => {
          const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        const face = (color: string) => (
          <>
            <Ionicons name={icon} size={22} color={color} />
            <T w="semibold" size={11} color={color} style={st.label}>
              {title}
            </T>
          </>
        );
        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={title} onPress={onPress} style={st.item}>
            <Animated.View style={[st.item, { opacity: Animated.subtract(1, lit) }]}>{face(c.muted)}</Animated.View>
            <Animated.View style={[st.item, StyleSheet.absoluteFill, { opacity: lit }]} pointerEvents="none">
              {face(c.accent)}
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: "row", marginHorizontal: 12, borderRadius: 20, height: 68, paddingTop: 8, paddingBottom: 8 },
  shadow: { shadowColor: "#141928", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { lineHeight: 15 },
});
