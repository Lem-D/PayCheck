# PayCheck design

## Goal

Help one person build better saving and spending habits by deciding where each paycheque goes before spending it. You set a spending limit per category, and everything left over is moved into savings (TFSA, regular savings, or both). The app also keeps a picture of what you have and what you owe.

Non-goals: no bank connections or transaction imports, no multi-user budgets, no investment tracking beyond balances.

## Platform

- **Phone app** (`mobile/`): Expo SDK 57, React Native, TypeScript, Expo Router for the five tabs. Runs in Expo Go during development and builds to standalone iOS and Android apps with EAS.
- **Home screen app**: the phone app's web build (react-native-web), hosted by Expo (EAS Hosting, `npm run deploy:web` in `mobile/`) at an `expo.app` address and added to the iPhone home screen from Safari. Lem uses Apple devices and picked this on Oct 15 because it's free and doesn't expire; after trying GitHub Pages and Render the same day, Lem settled on Expo hosting. `mobile/scripts/web-pwa.mjs` adds the manifest, icons, full-screen tags and a `404.html` fallback after `expo export`. Data lives in that home screen app's own storage (`localStorage` through AsyncStorage), and the app asks the browser to keep it (`navigator.storage.persist`).
- **Prototype** (`index.html`): the original single page in plain HTML, CSS and JavaScript. Kept as a reference; new features go in the phone app.
- Light and dark themes follow the phone's setting. Colours and fonts live in `mobile/src/theme.ts`; see Look below.
- Currency is Canadian dollars, formatted with `Intl.NumberFormat("en-CA", { currency: "CAD" })`. All amounts are rounded to cents when saved.

### Code layout (phone app)

- `src/types.ts`: the data model below, shared by all screens.
- `src/lib/allocate.ts`: pure functions for the payday allocation and logging, covered by `allocate.test.ts`.
- `src/lib/store.tsx`: one React context holding accounts and the plan, loaded from and saved to the phone.
- `src/app/`: one file per screen.

## Look

Harbour Gold, picked by Lem on Oct 14 from the colour and layout options. Gold always means saving and sky blue always means spending.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `bg` | `#f2f5fa` | `#0e1626` | Screen background |
| `surface` | `#ffffff` | `#152036` | Tiles and the tab bar |
| `ink` / `muted` | `#13203a` / `#5f6b82` | `#eef2f8` / `#8e9ab0` | Text |
| `line` / `track` | `#dfe5ef` / `#e3e9f2` | `#24314b` | Dividers, empty rings and bars |
| `accent` | `#c48410` | `#f2bf4b` | Saving: goal rings, the main button, selected chips |
| `spend` | `#2f6fd6` | `#6fb6ff` | Spending: the payday ring track, purchases |
| `good` | `#1f9a6c` | `#5fd3a5` | Net worth, finished goals |
| `warn` | `#c27a00` | `#f2bf4b` | A limit 75% used |
| `bad` | `#d24a3c` | `#ff7a6b` | Over a limit, debts |

- **Font.** Outfit (400, 500, 600, 700) from `@expo-google-fonts/outfit`, with tabular numbers so amounts line up.
- **Tiles.** Rounded panels (radius 18) on the background. Light mode adds a soft shadow; dark mode relies on the lighter surface. Spend and Save tiles are tinted with their colour mixed into the surface.
- **Rings.** Drawn with `react-native-svg`. Payday has one big ring holding the pay amount (gold arc for the share saved, blue for the rest). Spending has a small ring for the period, and each goal has a ring with its percent saved.
- **Screens.** Each tab starts with a bold title and an optional pill (today's date, days left). Spending limits and accounts are two-column tile grids; debt tiles get a red outline.
- **Logo.** K "P Bill" (a blue bill with a P and a gold coin stack) is the app icon and splash; A "Split Ring" is the second logo for small spots. Files and how the icons are made are in `mockups/logo/README.md`. The splash uses the light or dark background to match the phone.
- **Tab bar.** A floating rounded bar inset from the screen edges, with outline icons and the active tab in gold. Swiping the screen left or right also changes tabs (Expo Router's top tabs, drawn at the bottom), and the gold follows the swipe as it happens.

## Storage

**Phone app.** Data is stored on the phone with AsyncStorage, under the same keys and in the same shapes as the prototype (`paycheque-plan-accounts`, `paycheque-plan-plan`), plus `paycheque-plan-spending` for purchases. It saves 0.4 seconds after the last change. Older saved plans are migrated on load (the old `pay` and percentage `savings` fields are dropped).

**Sync between devices (phone app).** Picked by Lem on Oct 15. Signing in (email and password, Firebase Authentication) links the device's data to the account, and Firestore holds the account's copy, all under `users/{uid}`: `sections/accounts` and `sections/plan` each store the whole document as JSON with an `updatedAt` time, and each purchase is its own document in `purchases/{id}`. Firebase was chosen because its free plan doesn't pause idle projects and its JS SDK works in Expo Go, the home screen app and native builds.

- Accounts and the plan sync as a whole and the newest change wins. `firestore.rules` refuses a save whose `updatedAt` isn't newer than the stored one, so a change made offline can't overwrite a later one from another device when it finally arrives.
- Purchases sync one at a time, so purchases logged on two devices at once both survive.
- Data still lives on the device first (AsyncStorage). The sync engine (`mobile/src/lib/sync/engine.ts`) remembers in `paycheque-plan-sync` which changes haven't been confirmed by the cloud, and sends them on the next start, so changes made offline or right before closing the app aren't lost.
- Signing in on a device whose numbers differ from the account's asks which to keep. An empty device takes the account's numbers, and an empty account takes the device's.
- The app opens on a sign-in screen (`mobile/src/components/SignInScreen.tsx`, laid over the tabs in `_layout.tsx`) and can't be used until someone signs in; Lem asked for this on Oct 15. Signing out (Accounts tab) stops syncing, keeps the data on the device, and brings the sign-in screen back.
- Sync is hidden until a Firebase project's config is put in `mobile/src/lib/sync/config.ts`. Firebase is loaded only when it's set, as its own bundle on the web.
- Tests: `engine.test.ts` runs two or three simulated devices against an in-memory cloud, including going offline. It was also checked on Oct 15 with three browser copies of the web build against the Firebase emulators (`EXPO_PUBLIC_FIREBASE_EMULATOR=127.0.0.1` points a build at them; build without it, and with `--clear`, for real use).

**Backup file (phone app).** The Accounts tab's "Your data" section saves everything to one JSON file and restores it, so data survives a lost phone, a reinstall, or a move from Expo Go to the installed app. Logic is in `mobile/src/lib/backup.ts` (covered by `backup.test.ts`); the share sheet and file picker are in `backupFile.ts` (`expo-sharing`, `expo-file-system`, `expo-document-picker`).

```js
{ kind: "paycheck-backup", version: 1, exportedAt, accounts: { accounts, debts }, plan, spending }
```

- Saving opens the share sheet (Save to Files, iCloud Drive, AirDrop, email), named like `PayCheck backup 2026-10-15.json`. In a browser it downloads.
- Restoring shows what the file holds and replaces all data after a second tap. Each part goes through the same normalize functions as data loaded at startup, so older or partial files fill in defaults. Files that aren't PayCheck backups, or come from a newer version, are refused with a message.
- The last backup date is kept under `paycheque-plan-last-backup` and turns yellow after 30 days.

**Prototype.** Two layers, written on every change:

1. **localStorage** in the current browser, so the page works when opened straight from the file system.
2. **Artifact database** (`window.claude.use("db")`) when the page is hosted as a Claude artifact. Owner-only read and write, so only Lem sees the numbers. It syncs across devices and is the source of truth when present; `onSnapshot` refreshes the page when data changes elsewhere.

If the database write fails, the change stays in localStorage and the status line says so. If the database is empty but localStorage has data, the local data is uploaded. Splitter edits save 0.6 seconds after typing stops.

Each feature keeps its own document (localStorage keys `paycheque-plan-accounts`, `paycheque-plan-plan` and `paycheque-plan-tab` mirror them) under the `budget` collection so steps can ship independently:

| Document | Step | Holds |
| --- | --- | --- |
| `budget/accounts` | 1 | accounts and debts |
| `budget/plan` | 2 | pay frequency, spending limits, savings goals, leftover destination, payday log |
| `paycheque-plan-spending` | 3 | logged purchases (phone app only) |

## Data model

### Step 1: accounts and debts (built)

```js
budget/accounts = {
  accounts: [{ id, name, kind, balance, updated }],
  debts:    [{ id, name, kind, balance, rate?, minPayment?, updated }],
  updatedAt
}
```

- `kind` for accounts: Chequing, Savings, TFSA, RRSP, FHSA, Cash, Other.
- `kind` for debts: Credit card, Line of credit, Car loan, Student loan, Personal loan, Owed to someone, Other.
- `balance` is always a positive number; debts are subtracted for net worth.
- `rate` is an annual percentage, `minPayment` a dollar amount, both optional.
- `updated` and `updatedAt` are millisecond timestamps.

Net worth = sum of account balances − sum of debt balances.

### Step 2: payday from goals (built)

Redesigned on Oct 14 after Lem's feedback: "I just enter the amount I got paid and it tells me where it goes based off of my goals." The earlier percentage split is gone.

```js
plan = {
  frequency: "biweekly",                      // weekly | biweekly | semimonthly | monthly
  categories: [{ id, name, limit }],          // spending limits per pay period
  goals: [{ id, name, accountId, target, saved, date }],  // date is "YYYY-MM-DD" or ""
  extraTo: "goal:<id>" | "acct:<id>" | "",    // where leftover money goes; "" keeps it in chequing
  paydays: [{ date, pay, spend, saved, moves: [{ accountId, name, amount }], applied }],
  updatedAt
}
```

The amount you got paid isn't stored; you type it in fresh each payday. `paydays` keeps the latest 60 entries.

**Allocation** (`allocate(pay)` in `mobile/src/lib/allocate.ts`):

1. Spending limits are filled first, in list order. If the cheque can't cover them, the shortfall is shown and goals get nothing.
2. Each unfinished goal with a date needs `ceil((target − saved) / paydaysLeft)`, rounded up to the cent, where `paydaysLeft = max(1, ceil(daysUntilEndOfDate / periodDays))` and periodDays is 7, 14, 365.25/24 or 365.25/12. It's capped at what's left to reach the target.
3. If the dated goals need more than what's left, every goal is scaled down by the same factor, and any rounding cent goes to the first goal.
4. What's still left goes to the "left over" destination. A goal there is capped at its remaining target; anything beyond stays in chequing as unassigned.
5. Transfers are grouped by account.

Goals without a date only get leftover money. Logging a payday (tap twice to confirm) records it and, if ticked, adds the transfers to account balances and goal progress. Deleting an account moves its goals to chequing; deleting a goal or account clears it as the leftover destination.

### Step 3: tracking spending (built)

```js
spending = {
  purchases: [{ id, categoryId, amount, note, at }],  // newest first, latest 2000 kept
  updatedAt
}
```

Stored on the phone under `paycheque-plan-spending`. Logic lives in `mobile/src/lib/spending.ts`.

- **Pay period.** The current period starts at the most recent logged payday and runs one pay frequency (7, 14, 365.25/24 or 365.25/12 days). Logging a payday on the Payday tab starts a new period, so limits reset when you get paid. Before any payday is logged, every purchase counts.
- **Per category.** left = limit − Σ purchases in this period. The colour is normal under 75% of the limit used, yellow from 75%, red at 100% or more. A $0 limit turns red as soon as anything is spent there.
- **Totals.** Left to spend across all limits, and days until the expected next payday. Purchases in categories that have since been removed still count toward the total and are called out.
- Deleting a purchase takes a second tap to confirm.

### Step 4: habit history (built)

Logic lives in `mobile/src/lib/history.ts`, covered by `history.test.ts`. Nothing new is stored except two fields on each payday:

```js
paydays: [{ ..., limits: [{ id, name, limit }], goals: [{ id, amount }] }]
```

`limits` are the spending limits when the payday was logged, so a period is judged against the limits it had even if you change them later. `goals` is what each goal got that payday (its dated share plus any leftover). Paydays logged before step 4 don't have them: those periods use today's limits and say so, and goal pace starts with the next payday.

- **Pay periods.** Each logged payday starts one, and it ends when the next payday is logged. The latest is still running and shows "so far". Purchases before the first logged payday aren't counted.
- **Limit kept** means spending in that category was no more than its limit (spending exactly the limit counts as kept, though the Spending tab already shows it red). Spending in categories that weren't limits that period is shown separately.
- **Summary** covers finished periods only: share of limits kept, total and average saved per payday, savings rate, and the streak of periods in a row (counting back from the latest) where every limit was kept. Each category shows how many periods it was kept and a dot per period for the last 8.
- **Goal pace.** What each goal got on average over the last three paydays that recorded it, against what it needs per paycheque now (`perPaycheque`). On track if it's getting at least that much, behind if not. At the current pace, the finish date is `now + ceil(remaining / average) × period length`. Goals without a date show their pace only.

## Screens

The phone app has five tabs in a bottom bar, and you can swipe sideways between them: **Payday** (the default), **Spending**, **Goals**, **Accounts** and **History**. The prototype has the same tabs minus Spending; there, the last tab used is remembered per browser and `#payday`, `#goals` or `#accounts` in the URL picks one.

1. **Payday** (built). One big "I got paid" amount. As you type, it shows keep for spending versus move to savings, notes (shortfall, unassigned money, savings rate), transfers to make per account, what each goal gets with amount to go, date and paydays left, and each category's spending money. "I moved the money" logs it. The last 6 paydays are listed. With no limits or goals yet, it shows a "Set up my goals" prompt.
2. **Goals** (built). Savings goals with progress and the per-paycheque amount; pay frequency and spending limits ("Start with common categories" seeds Rent, Groceries, Phone, Transit or gas, Eating out, Fun money); and where anything left over goes.
3. **Accounts** (built). Net worth headline with a have/owe bar, then account and debt lists. Tapping a row opens an inline editor; delete needs a second tap to confirm.
4. **Spending** (built, phone app). Left to spend this period with days until payday, a quick "Log a purchase" form (amount, which limit, optional note), each limit with what's left and its colour, and this period's purchases with delete.
5. **History** (built, phone app). A ring for the share of limits kept with the streak, saved in total and per payday, each goal's pace (on track or behind, needed versus getting per pay), each limit's record with a dot per pay period, and one tile per pay period with what was saved and which limits went over.

## Plan

1. Accounts and debts with net worth. Done.
2. Payday from goals. Done.
3. Track spending against limits. Done in the phone app.
4. Habit history. Done in the phone app.
