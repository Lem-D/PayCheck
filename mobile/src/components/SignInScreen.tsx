import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "../lib/store";
import { font, useColors } from "../theme";
import { ChooseCard } from "./SyncPanel";
import { Button, Muted, Note, T } from "./ui";

const BILL = { light: require("../../assets/bill-light.png"), dark: require("../../assets/bill-dark.png") };

/** An email or password box drawn as a tile, with its small label above what you type. */
function Field({ label, ...rest }: TextInputProps & { label: string }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[st.field, { backgroundColor: c.surface, borderColor: focused ? c.accent : c.surface }, c.shadow && st.shadow]}>
      <T w="semibold" size={12} color={c.muted}>
        {label}
      </T>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[font("regular"), st.input, { color: c.ink }]}
      />
    </View>
  );
}

function Link({ title, onPress, color, disabled }: { title: string; onPress: () => void; color: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} hitSlop={10} style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.6 : 1 })}>
      <T w="semibold" size={14} color={color}>
        {title}
      </T>
    </Pressable>
  );
}

/**
 * The first screen ("the bill, straight from the splash", option A of design/sign-in): the app can't be
 * used until someone signs in. Also shown right after signing in when this device's numbers differ from the account's.
 */
export default function SignInScreen() {
  const c = useColors();
  const { sync } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "good" | "bad"; text: string } | null>(null);
  const choosing = sync.status.state === "choose";

  const run = async (f: () => Promise<string | null>, good?: string) => {
    setBusy(true);
    setMessage(null);
    const err = await f();
    setBusy(false);
    if (err) setMessage({ kind: "bad", text: err });
    else if (good) setMessage({ kind: "good", text: good });
  };
  const signIn = () => run(() => sync.signIn(email, password));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
          <View style={st.grow} />
          <View style={st.hero}>
            <Image source={c.shadow ? BILL.light : BILL.dark} style={st.bill} resizeMode="contain" accessibilityIgnoresInvertColors />
            <T w="semibold" size={30} style={st.wordmark} accessibilityRole="header">
              Pay<T w="semibold" size={30} color={c.accent}>Check</T>
            </T>
            <Muted size={15} style={{ textAlign: "center" }}>
              Decide where each paycheque goes{"\n"}before you spend it.
            </Muted>
          </View>
          <View style={st.grow} />
          {choosing ? (
            <ChooseCard />
          ) : (
            <View style={st.form}>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username" placeholder="you@example.com" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" placeholder="At least 6 characters" onSubmitEditing={signIn} />
              <Button kind="primary" title={busy ? "Signing in…" : "Sign in"} disabled={busy} onPress={signIn} />
              <View style={st.split}>
                <Link title="Create account" color={c.accent} disabled={busy} onPress={() => run(() => sync.signUp(email, password))} />
                <Link
                  title="Forgot password?"
                  color={c.muted}
                  disabled={busy}
                  onPress={() => run(() => sync.resetPassword(email), `If there's an account for ${email.trim()}, an email to reset the password is on its way.`)}
                />
              </View>
              {message ? <Note kind={message.kind}>{message.text}</Note> : null}
            </View>
          )}
          <View style={st.grow} />
          <Muted size={13} style={{ textAlign: "center" }}>
            Your numbers are saved on this phone and in your account,{"\n"}so they're the same on your iPhone, iPad and Mac.
          </Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20, gap: 14, maxWidth: 440, width: "100%", alignSelf: "center" },
  grow: { flexGrow: 1, minHeight: 8 },
  hero: { alignItems: "center", gap: 10 },
  bill: { width: 118, height: 75 },
  wordmark: { lineHeight: 34, letterSpacing: -0.4 },
  form: { gap: 10 },
  field: { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 13, paddingTop: 8, paddingBottom: 6 },
  shadow: { shadowColor: "#141928", shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  input: { fontSize: 16, paddingVertical: 2, outlineStyle: "none" } as object,
  split: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingTop: 2 },
});
