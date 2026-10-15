# PayCheck mobile app

The native iOS and Android version of PayCheck, built with Expo and React Native. It has five tabs:

- **Payday**: type in what you got paid and it tells you where every dollar goes: spending money, what each goal gets, and the transfers to make. Then log the payday.
- **Spending**: log purchases as you make them. Each spending limit shows what's left until payday, turning yellow at 75% used and red at 100%.
- **Goals**: savings goals (target, saved so far, optional date, which account), how often you're paid, spending limits, and where leftover money goes.
- **Accounts**: your accounts and debts, with net worth. At the bottom, **Your data** saves everything to a backup file and restores it.
- **History**: each pay period with what you saved and which limits you kept, your streak, and whether each goal is on track for its date.

Your data is saved on the phone (AsyncStorage). There's no account or server.

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
| `src/app/_layout.tsx` | Tab navigation (Expo Router), fonts and the floating tab bar |
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
| `src/lib/store.tsx` | App state and saving to the phone |
| `src/lib/backup.ts`, `backupFile.ts` | The backup file: what's in it and checking it (`backup.ts`), and saving or picking it on the phone (`backupFile.ts`) |
| `src/types.ts` | Data types shared by everything |

## On your iPhone home screen (free)

The web version installs like an app from Safari, on iPhone, iPad and Mac, with no App Store and nothing to renew. It's published at **https://lem-d.github.io/PayCheck/** by GitHub Pages: every push to `main` that changes `mobile/` runs the tests, builds it (`npm run build:web`) and publishes it (`.github/workflows/pages.yml`).

One-time setup on GitHub: in the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**. Then push, and the Actions tab shows the build.

To install it on your iPhone:

1. Open https://lem-d.github.io/PayCheck/ in Safari.
2. Tap the Share button, then **Add to Home Screen**, then **Add**.
3. Open PayCheck from the home screen. It runs full screen with the P Bill icon.

Your numbers are kept inside the home screen app on that device, separate from Safari and from Expo Go. To move them, use **Save a backup** and **Restore from a backup** on the Accounts tab; on the iPhone, Save a backup opens the share sheet so you can pick **Save to Files**. Back up now and then: if you delete the home screen icon, its data goes with it.

`npm run build:web` builds it locally into `dist/`. The site lives under `/PayCheck/`, set by `experiments.baseUrl` in `app.json`.

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
