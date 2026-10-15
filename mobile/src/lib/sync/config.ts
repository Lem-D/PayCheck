import type { FirebaseOptions } from "firebase/app";

/**
 * The Firebase project that holds synced data. Sync is hidden until this is filled in.
 * To set it up, follow "Sync between devices" in the main README, then replace `null` below with the
 * `{ apiKey: ..., ... }` part of the firebaseConfig the Firebase console shows. These values aren't secret:
 * the security rules in `firestore.rules` are what keep each person's data private.
 */
export const firebaseConfig: FirebaseOptions | null = null;

/** Set only when building for the browser tests, which use Firebase's local emulators instead of a real project. */
export const emulatorHost: string | undefined = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR || undefined;

export const activeConfig: FirebaseOptions | null = {
    apiKey: "AIzaSyB-5fSjuYX0EJP7Mxoc6RLT5qv-gT14aZw",
    authDomain: "paycheck-4acc4.firebaseapp.com",
    projectId: "paycheck-4acc4",
    storageBucket: "paycheck-4acc4.firebasestorage.app",
    messagingSenderId: "461838471621",
    appId: "1:461838471621:web:fb659bda4c13468429fbac"
  };