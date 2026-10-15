# PayCheck mobile app

The native iOS and Android version of PayCheck, built with Expo and React Native. It has five tabs. Tap them in the bar at the bottom, or swipe left and right to move between them:

- **Payday**: type in what you got paid and it tells you where every dollar goes: spending money, what each goal gets, and the transfers to make. Then log the payday.
- **Spending**: log purchases as you make them. Each spending limit shows what's left until payday, turning yellow at 75% used and red at 100%.
- **Goals**: savings goals (target, saved so far, optional date, which account), how often you're paid, spending limits, and where leftover money goes.
- **Accounts**: your accounts and debts, with net worth. At the bottom, **Your data** saves everything to a backup file and restores it.
- **History**: each pay period with what you saved and which limits you kept, your streak, and whether each goal is on track for its date.

Your data is saved on the device (AsyncStorage). The app opens on a sign-in screen, and signing in syncs your data between devices through Firebase; see "Sync between devices" in the [main README](../README.md#sync-between-devices).

The look is Harbour Gold: navy and white with gold for saving and sky blue for spending, progress rings and rounded tiles, in light or dark to match your phone. See the Look section in [DESIGN.md](../DESIGN.md).

## Run it on your phone

1. Install **Expo Go** from the App Store or Google Play.
2. In this folder:
   ```bash
   npm install
   npm start
   ```
3. Scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android). Your phone and computer need to be on the same Wi-Fi; if they aren't, run `npx expo start --tunnel`.

`npm run web` opens it in a browser, and `npm run ios` or `npm run android` opens a simulator if you have Xcode or Android Studio.

## Develop

```bash
npm test           # unit tests for the payday allocation, spending and history
npm run typecheck  # TypeScript
```

Code layout:

| Path | What it is |
| --- | --- |
| `src/app/_layout.tsx` | Swipeable tab navigation (Expo Router top tabs, shown at the bottom) and fonts |
| `src/components/TabBar.tsx` | The floating tab bar, which lights up the tab you're swiping to |
| `src/app/index.tsx` | Payday screen |
| `src/app/spending.tsx` | Spending screen |
| `src/app/goals.tsx` | Goals screen |
| `src/app/accounts.tsx` | Accounts screen |
| `src/app/history.tsx` | History screen |
| `src/theme.ts` | Harbour Gold colours (light and dark) and the Outfit font |
| `src/components/` | Shared UI: tiles, rings, bars, buttons, inputs, the screen wrapper, and the account and goal editors |
| `src/lib/allocate.ts` | How a paycheque is divided between spending and goals, and payday logging |
| `src/lib/spending.ts` | Pay periods and what's left in each spending limit |
| `src/lib/history.ts` | Past pay periods, limits kept, savings and goal pace |
| `src/lib/store.tsx` | App state, saving to the device, and starting sync when signed in |
| `src/lib/sync/` | Sync between devices: the rules for merging (`merge.ts`), the engine that keeps a device and the account in step (`engine.ts`, tested in `engine.test.ts`), Firebase sign-in and storage (`firebase.ts`), and the project settings (`config.ts`) |
| `src/components/SignInScreen.tsx` | The sign-in screen the app opens on |
| `src/components/SyncPanel.tsx` | The Sync section on the Accounts tab (sync status and Sign out), and the sign-in form |
| `firestore.rules` | Firestore security rules: each person only sees their own data, and an older change can't replace a newer one |
| `src/lib/backup.ts`, `backupFile.ts` | The backup file: what's in it and checking it (`backup.ts`), and saving or picking it on the phone (`backupFile.ts`) |
| `src/types.ts` | Data types shared by everything |

## On your iPhone home screen (free)

The web version installs like an app from Safari, on iPhone, iPad and Mac, with no App Store and nothing to renew. It's hosted by Expo (EAS Hosting) at an `expo.app` address.

To publish it, from this folder:

1. Make a free account at expo.dev if you don't have one (the same account works for Expo Go), then run `npx eas-cli@latest login`.
2. Run:
   ```bash
   npm run deploy:web
   ```
   This builds the web version (`npm run build:web`, into `dist/`) and uploads it. The first time, it offers to create the Expo project (say yes) and asks you to pick a name for the address. Pick something like `paycheck`, and the app lives at **https://paycheck.expo.app**. It adds the project's id to `app.json`, so commit that change.
3. To publish a change later, run `npm run deploy:web` again. The home screen app picks it up the next time you open it.

To install it on your iPhone:

1. Open your `expo.app` address in Safari. The terminal prints it after the deploy, and it's also on expo.dev under the project's Hosting page.
2. Tap the Share button, then **Add to Home Screen**, then **Add**.
3. Open PayCheck from the home screen. It runs full screen with the P Bill icon.

Your numbers are kept inside the home screen app on that device, separate from Safari and from Expo Go. To move them, use **Save a backup** and **Restore from a backup** on the Accounts tab; on the iPhone, Save a backup opens the share sheet so you can pick **Save to Files**. Back up now and then: if you delete the home screen icon, its data goes with it.

## Installing it for real

For an App Store-style app instead, there are native builds. Expo Go is for trying changes. To have PayCheck on your phone as its own app, with the P Bill icon, build it with EAS, Expo's build service. The builds run on Expo's servers, so you don't need Android Studio or Xcode. `eas.json` has the settings.

1. Make a free account at expo.dev.
2. In this folder, run the build for your phone:
   ```bash
   npm run build:android   # an installable .apk, free
   npm run build:ios       # needs an Apple Developer account
   ```
   The first time, it asks you to log in. It also offers to create the Expo project (say yes), and for Android to generate a signing key (say yes, and Expo keeps it for you). It adds the project's id to `app.json`, so commit that change.
3. When the build finishes, the terminal and expo.dev show a link and a QR code.
   - **Android:** open the link on your phone and install the .apk. Your phone asks you to allow installs from your browser the first time.
   - **iPhone:** the first build asks you to register your phone (scan a QR code to add it), then installs from the link. This needs the Apple Developer Program.

Your data stays on the phone. The installed app and Expo Go each keep their own data. To bring your numbers across, tap **Save a backup** on the Accounts tab in Expo Go, then **Restore from a backup** in the installed app.

To ship an update, change the code and run the build again; the version number goes up on its own.
