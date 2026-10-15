import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { describe, summarizeBackup } from "../lib/backup";
import { useStore } from "../lib/store";
import { useColors } from "../theme";
import { Button, Input, Muted, Note, Section, T, Tile } from "./ui";

const time = (t: number) => new Date(t).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

/** Sign in to keep the same numbers on every device. Hidden until sync is set up in `lib/sync/config.ts`. */
export default function SyncPanel() {
  const c = useColors();
  const { sync, acc, plan, spending } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "good" | "bad"; text: string } | null>(null);
  const [armed, setArmed] = useState(false);

  if (!sync.available) return null;
  const s = sync.status;

  const run = async (f: () => Promise<string | null>, good?: string) => {
    setBusy(true);
    setMessage(null);
    const err = await f();
    setBusy(false);
    if (err) setMessage({ kind: "bad", text: err });
    else if (good) setMessage({ kind: "good", text: good });
    else setPassword("");
  };

  if (!sync.email) {
    return (
      <Section title="Sync">
        <Tile style={{ gap: 10 }}>
          <T size={14}>Sign in to keep the same numbers on your iPhone, iPad and Mac. Changes show up on your other devices within a few seconds, and everything stays on this device too.</T>
          <Input placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username" accessibilityLabel="Email" />
          <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" accessibilityLabel="Password" onSubmitEditing={() => run(() => sync.signIn(email, password))} />
          <View style={st.row}>
            <Button kind="primary" title={busy ? "Signing in…" : "Sign in"} disabled={busy} onPress={() => run(() => sync.signIn(email, password))} />
            <Button title="Create account" disabled={busy} onPress={() => run(() => sync.signUp(email, password))} />
            <Button kind="quiet" title="Forgot password?" disabled={busy} onPress={() => run(() => sync.resetPassword(email), `If there's an account for ${email.trim()}, an email to reset the password is on its way.`)} />
          </View>
        </Tile>
        {message ? <Note kind={message.kind}>{message.text}</Note> : null}
      </Section>
    );
  }

  if (s.state === "choose") {
    const here = describe(summarizeBackup({ acc, plan, spending }, null));
    const there = describe(summarizeBackup(s.cloud, null));
    return (
      <Section title="Sync">
        <Tile style={{ gap: 10, borderWidth: 1.5, borderColor: c.warn }}>
          <T w="semibold">Which numbers do you want to keep?</T>
          <Muted size={14}>
            Your account already has numbers that are different from this device's. Your account has {there}. This device has {here}.
          </Muted>
          <Button kind="primary" title="Use my account's numbers" onPress={() => sync.choose("cloud")} />
          <Button
            kind={armed ? "dangerArmed" : "danger"}
            title={armed ? "Tap again to replace my account's numbers" : "Use this device's numbers"}
            onPress={() => (armed ? sync.choose("device") : setArmed(true))}
          />
          <Button kind="quiet" title="Cancel and sign out" onPress={sync.signOut} />
        </Tile>
      </Section>
    );
  }

  const line =
    s.state === "checking" ? "Connecting to your account…" : s.state === "saving" ? "Saving to your account…" : s.state === "synced" ? `Up to date, checked ${time(s.at)}` : "";

  return (
    <Section title="Sync">
      <Tile style={{ gap: 10 }}>
        <View style={st.status}>
          <View style={[st.dot, { backgroundColor: s.state === "error" ? c.bad : s.state === "synced" ? c.good : c.warn }]} />
          <T size={14} style={{ flex: 1 }}>
            Synced with <T w="semibold" size={14}>{sync.email}</T>
          </T>
        </View>
        {line ? <Muted size={13}>{line}</Muted> : null}
        <View style={st.row}>
          {s.state === "error" ? <Button kind="primary" title="Try again" onPress={sync.retry} /> : null}
          <Button title="Sign out" onPress={sync.signOut} />
        </View>
      </Tile>
      {s.state === "error" ? <Note kind="bad">{s.message}</Note> : null}
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  status: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
