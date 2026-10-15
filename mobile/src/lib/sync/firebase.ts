import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  connectAuthEmulator,
  type Auth,
  type Persistence,
  type User,
} from "firebase/auth";
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDocFromServer, getDocsFromServer, initializeFirestore, onSnapshot, setDoc, type Firestore } from "firebase/firestore";
import { Platform } from "react-native";
import type { Purchase } from "../../types";
import type { Remote } from "./engine";
import type { RemoteSection, SectionName } from "./merge";

export interface Cloud {
  auth: Auth;
  db: Firestore;
}

let cloud: Cloud | null = null;

/** Starts Firebase once. `emulator` points it at a local test server instead (used by the browser tests). */
export function connect(config: FirebaseOptions, emulator?: string): Cloud {
  if (cloud) return cloud;
  const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
  let auth: Auth;
  // Email and password only, so the web build skips Google's sign-in pop-up helpers.
  if (Platform.OS === "web") auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  else {
    // The React Native build of Firebase Auth has this; its types only list it for that build.
    const { getReactNativePersistence } = firebaseAuth as unknown as { getReactNativePersistence: (s: typeof AsyncStorage) => Persistence };
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  }
  const db = initializeFirestore(app, {});
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulator, 8080);
  }
  cloud = { auth, db };
  return cloud;
}

export const watchUser = (c: Cloud, cb: (u: User | null) => void) => onAuthStateChanged(c.auth, cb);

const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-password": "Type a password.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/email-already-in-use": "There's already an account with that email. Sign in instead.",
  "auth/invalid-credential": "That email and password don't match an account.",
  "auth/user-not-found": "That email and password don't match an account.",
  "auth/wrong-password": "That email and password don't match an account.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes, then try again.",
  "auth/network-request-failed": "Couldn't connect. Check your internet connection.",
};
export const authMessage = (e: unknown) => MESSAGES[(e as { code?: string })?.code ?? ""] ?? "Something went wrong. Try again.";

export const signIn = (c: Cloud, email: string, password: string) => signInWithEmailAndPassword(c.auth, email.trim(), password);
export const signUp = (c: Cloud, email: string, password: string) => createUserWithEmailAndPassword(c.auth, email.trim(), password);
export const resetPassword = (c: Cloud, email: string) => sendPasswordResetEmail(c.auth, email.trim());
export const logOut = (c: Cloud) => signOut(c.auth);

/**
 * Where everything lives in Firestore, all under the signed-in person's own id:
 * users/{uid}/sections/{accounts|plan} = { json, updatedAt }, and users/{uid}/purchases/{id} = one purchase.
 */
export function firestoreRemote(db: Firestore, uid: string): Remote {
  const section = (name: SectionName) => doc(db, "users", uid, "sections", name);
  const purchases = collection(db, "users", uid, "purchases");
  const asSection = (d: { exists(): boolean; data(): unknown }): RemoteSection | null => {
    if (!d.exists()) return null;
    const v = d.data() as RemoteSection;
    return typeof v.json === "string" && typeof v.updatedAt === "number" ? { json: v.json, updatedAt: v.updatedAt } : null;
  };
  const asPurchase = (id: string, v: Record<string, unknown>): Purchase => ({
    id,
    categoryId: String(v.categoryId ?? ""),
    amount: Number(v.amount) || 0,
    note: String(v.note ?? ""),
    at: Number(v.at) || 0,
  });

  return {
    async readAll() {
      const [accounts, plan, list] = await Promise.all([getDocFromServer(section("accounts")), getDocFromServer(section("plan")), getDocsFromServer(purchases)]);
      return { sections: { accounts: asSection(accounts), plan: asSection(plan) }, purchases: list.docs.map((d) => asPurchase(d.id, d.data())) };
    },
    watchSection(name, cb, onError) {
      let fromServer = false;
      return onSnapshot(
        section(name),
        { includeMetadataChanges: true },
        (d) => {
          // Before the first answer from the server, the copy here may just be empty. After that, it's kept current.
          if (!d.metadata.fromCache) fromServer = true;
          if (fromServer && !d.metadata.hasPendingWrites) cb(asSection(d));
        },
        onError,
      );
    },
    watchPurchases(cb, onError) {
      let fromServer = false;
      return onSnapshot(
        purchases,
        { includeMetadataChanges: true },
        (q) => {
          if (!q.metadata.fromCache) fromServer = true;
          if (fromServer) cb(q.docs.map((d) => asPurchase(d.id, d.data())));
        },
        onError,
      );
    },
    async putSection(name, r) {
      try {
        await setDoc(section(name), { json: r.json, updatedAt: r.updatedAt });
        return true;
      } catch (e) {
        // The rules refuse a change older than the one already saved. That's expected after being offline.
        if ((e as { code?: string })?.code === "permission-denied") return false;
        throw e;
      }
    },
    putPurchase: (p) => setDoc(doc(purchases, p.id), { categoryId: p.categoryId, amount: p.amount, note: p.note, at: p.at }),
    deletePurchase: (id) => deleteDoc(doc(purchases, id)),
  };
}
