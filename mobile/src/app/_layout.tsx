import Ionicons from "@expo/vector-icons/Ionicons";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from "@expo-google-fonts/outfit";
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider, type Theme } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ComponentProps } from "react";
import { View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StoreProvider } from "../lib/store";
import { FONTS, useColors } from "../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size - 2} />;

export default function RootLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [loaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  // The navigator paints behind the floating tab bar, so it needs the app's colours too.
  const base = c.shadow ? DefaultTheme : DarkTheme;
  const navTheme: Theme = { ...base, colors: { ...base.colors, background: c.bg, card: c.surface, text: c.ink, border: c.line, primary: c.accent } };
  return (
    <ThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StoreProvider>
          <StatusBar style="auto" />
          <Tabs
            safeAreaInsets={{ bottom: 0 }}
            screenOptions={{
              headerShown: false,
              sceneStyle: { backgroundColor: c.bg },
              tabBarActiveTintColor: c.accent,
              tabBarInactiveTintColor: c.muted,
              tabBarLabelStyle: { fontFamily: FONTS.semibold, fontSize: 11, lineHeight: 15, flexShrink: 0 },
              // A floating rounded bar, inset from the screen edges.
              tabBarStyle: {
                backgroundColor: c.surface,
                borderTopWidth: 0,
                marginHorizontal: 12,
                marginBottom: Math.max(12, insets.bottom),
                borderRadius: 20,
                height: 68,
                paddingTop: 6,
                paddingBottom: 8,
                elevation: c.shadow ? 3 : 0,
                shadowColor: "#141928",
                shadowOpacity: c.shadow ? 0.08 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
              },
              tabBarItemStyle: { paddingVertical: 0 },
            }}
          >
            <Tabs.Screen name="index" options={{ title: "Payday", tabBarIcon: icon("cash-outline") }} />
            <Tabs.Screen name="spending" options={{ title: "Spending", tabBarIcon: icon("cart-outline") }} />
            <Tabs.Screen name="goals" options={{ title: "Goals", tabBarIcon: icon("flag-outline") }} />
            <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarIcon: icon("wallet-outline") }} />
          </Tabs>
        </StoreProvider>
      </View>
    </ThemeProvider>
  );
}
