# PayCheck mobile app

The native iOS and Android version of PayCheck, built with Expo and React Native. It has five tabs:

- **Payday**: type in what you got paid and it tells you where every dollar goes: spending money, what each goal gets, and the transfers to make. Then log the payday.
- **Spending**: log purchases as you make them. Each spending limit shows what's left until payday, turning yellow at 75% used and red at 100%.
- **Goals**: savings goals (target, saved so far, optional date, which account), how often you're paid, spending limits, and where leftover money goes.
- **Accounts**: your accounts and debts, with net worth.
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
| `src/types.ts` | Data types shared by everything |

## Installing it for real

Expo Go is for development. To get a standalone app on your phone, build it with EAS: `npx eas-cli@latest build --profile preview --platform android` (an installable APK) or `--platform ios` (needs an Apple Developer account).
