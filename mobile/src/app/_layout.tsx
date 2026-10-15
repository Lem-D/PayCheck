import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from "@expo-google-fonts/outfit";
import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from "expo-router";
import TopTabs, { type MaterialTopTabBarProps } from "expo-router/js-top-tabs";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import SignInScreen from "../components/SignInScreen";
import TabBar from "../components/TabBar";
import { ReminderProvider } from "../lib/reminder";
import { StoreProvider, useStore } from "../lib/store";
import { useColors } from "../theme";

export default function RootLayout() {
  const c = useColors();
  const [loaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  // The navigator paints behind the floating tab bar, so it needs the app's colours too.
  const base = c.shadow ? DefaultTheme : DarkTheme;
  const navTheme: Theme = { ...base, colors: { ...base.colors, background: c.bg, card: c.surface, text: c.ink, border: c.line, primary: c.accent } };
  return (
    <ThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StoreProvider>
          <ReminderProvider>
            <StatusBar style="auto" />
            {/* Swipe sideways between tabs, or tap them in the floating bar. */}
            <TopTabs tabBarPosition="bottom" tabBar={(props: MaterialTopTabBarProps) => <TabBar {...props} />} screenOptions={{ sceneStyle: { backgroundColor: c.bg } }}>
              <TopTabs.Screen name="index" options={{ title: "Payday" }} />
              <TopTabs.Screen name="spending" options={{ title: "Spending" }} />
              <TopTabs.Screen name="goals" options={{ title: "Goals" }} />
              <TopTabs.Screen name="accounts" options={{ title: "Accounts" }} />
              <TopTabs.Screen name="history" options={{ title: "History" }} />
            </TopTabs>
            <SignInGate />
          </ReminderProvider>
        </StoreProvider>
      </View>
    </ThemeProvider>
  );
}

/** Covers the tabs with the sign-in screen until someone signs in, so nothing in the app can be used signed out. */
function SignInGate() {
  const c = useColors();
  const { ready, sync } = useStore();
  if (!sync.available) return null;
  const waiting = !ready || !sync.authKnown;
  const show = waiting || !sync.email || sync.status.state === "choose";
  if (!show) return null;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>{waiting ? null : <SignInScreen />}</View>;
}
