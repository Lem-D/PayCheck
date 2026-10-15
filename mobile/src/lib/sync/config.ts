import type { FirebaseOptions } from "firebase/app";

/**
 * The Firebase project that holds synced data (Lem's "paycheck-4acc4"). Sync is hidden when this is null.
 * It's the firebaseConfig from Firebase console > Project settings > Your apps. These values aren't secret:
 * the security rules in `firestore.rules` are what keep each person's data private.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: "AIzaSyB-5fSjuYX0EJP7Mxoc6RLT5qv-gT14aZw",
  authDomain: "paycheck-4acc4.firebaseapp.com",
  projectId: "paycheck-4acc4",
  storageBucket: "paycheck-4acc4.firebasestorage.app",
  messagingSenderId: "461838471621",
  appId: "1:461838471621:web:fb659bda4c13468429fbac",
};

/** Set only when building for the browser tests, which use Firebase's local emulators instead of a real project. */
export const emulatorHost: string | undefined = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR || undefined;

export const activeConfig: FirebaseOptions | null = emulatorHost ? { apiKey: "demo-key", projectId: "demo-paycheck", authDomain: "demo-paycheck.firebaseapp.com" } : firebaseConfig;
