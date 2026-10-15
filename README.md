# PayCheck

A personal budgeting app built around one idea: every paycheque gets split up front. You give yourself a set amount to spend per category, and the rest goes straight into savings (TFSA, a regular savings account, or both).

## What's here

- **`mobile/`**: the PayCheck phone app (Expo and React Native, for iOS and Android). This is where new work goes. See [mobile/README.md](mobile/README.md) to run it on your phone.
- **`mockups/`**: the colour, layout and logo options that were tried, the Harbour Gold design that was picked, and the final logo files in `mockups/logo/`. See [mockups/README.md](mockups/README.md).
- **`index.html`**: the original single-page prototype. Open it in a browser and it works on its own, saving your numbers in that browser. The hosted version, [Paycheque Plan](https://claude.ai/artifact/9oKM98u3YgoHKojCjcB5Ae), also syncs across devices.

## Plan

1. **Accounts and debts** (done). Enter each account (chequing, savings, TFSA, RRSP, FHSA) with its balance, plus anything you owe (credit cards, loans). Shows your net worth at a glance.
2. **Payday from goals** (done). Type in what you got paid and it tells you where it goes: spending limits first, then what each savings goal needs to hit its date, then leftovers to the goal or account you pick. It lists the transfers to make.
3. **Track spending against your limits** (done in the phone app). Log purchases by hand as they happen; each category shows how much is left until next payday, turning yellow and red as you get close.
4. **Habit tracking** (done in the phone app). A history per pay period showing whether you stayed under each limit and how much you saved, and how each goal is tracking.

See [DESIGN.md](DESIGN.md) for the data model, storage and screens.

Format: a native phone app with your data saved on the phone. No bank connection; you type amounts in.
