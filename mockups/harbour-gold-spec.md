# Harbour Gold: chosen design for the PayCheck app

Lem picked this on Oct 14: the **rings and tiles** layout with the **Harbour Gold** palette, light and dark (follows the phone setting).
Mockups: https://claude.ai/artifact/HGaD5gxYmyYcCJRJtkhLCr (the "Harbour Gold" row). Mock source: [harbour-palettes.html](harbour-palettes.html) (templates in the `S` object).

## Palette (replaces `mobile/src/theme.ts` values)

Meaning: `accent` (gold) = saving (ring, goals, main button). `spend` (blue) = spending. Over a limit = `owe`/bad red, 75%+ used = `warn`.

| Token | Light | Dark |
| --- | --- | --- |
| bg | #f2f5fa | #0e1626 |
| surface (tiles) | #ffffff | #152036 |
| ink | #13203a | #eef2f8 |
| muted | #5f6b82 | #8e9ab0 |
| line | #dfe5ef | #24314b |
| track (empty ring/bar, pills) | #e3e9f2 | #24314b |
| accent (saving, gold) | #c48410 | #f2bf4b |
| accentInk (text on gold) | #1b1405 | #1b1405 |
| spend (blue) | #2f6fd6 | #6fb6ff |
| good (net worth, positive) | #1f9a6c | #5fd3a5 |
| owe / bad | #d24a3c | #ff7a6b |
| warn | #c27a00 | #f2bf4b |

Soft fills (accentSoft, oweSoft, warnSoft) can be derived as ~14% of the colour over `surface`.
Light-mode tiles get a faint shadow (0 1px 2px rgba(20,25,40,.06)); dark mode tiles have none.
Font in the mock is Outfit (expo-google-fonts `@expo-google-fonts/outfit`); numbers use tabular figures.

## Layout: rings and tiles

- No bordered stacked cards. Content sits in rounded tiles (radius 16, padding 10–12) on `bg`, often in a 2-column grid (gap 8).
- Bottom tab bar is a floating rounded pill (radius 18, `surface`, inset 12 from the sides and bottom). Active tab in gold.
- Small status chips ("Fri Oct 10", "9 days left") are pills on `track` with `muted` text.

**Payday**: title row + date pill. One large ring (~150pt, stroke 14): spend portion in blue as the track, saved portion in gold. Centre: "I got paid", the amount (entry), "30% saved" in gold. Below: two tiles side by side, Spend (blue amount) and Save (gold amount). Then a "Move now" tile listing transfers per account. Then the gold "I moved the money" button. Notes, goal breakdown and history continue below as tiles.

**Spending (step 3)**: title "This pay period" + "N days left" pill. Summary tile: "Left to spend" big number with a small ring (46pt) of % used in blue. Then a 2-column grid of category tiles: name (muted), remaining amount coloured by state (blue normal, warn at 75%+, red when over shown as "−$4", muted "Paid" for fully paid bills), thin 4pt bar.

**Goals**: one tile per goal with a 58pt progress ring (gold) and % inside; name, "$saved of $target", "+$X per pay · by date". Tile for "Anything left over → goal". Dashed "+ New goal" tile. Spending limits and frequency go below as tiles.

**Accounts**: net worth tile (big number in `good`, have/owe bar green vs red, "Have $x / Owe $y" captions). Then a 2-column grid of account tiles (kind, name, balance) and debt tiles (kind · rate, name, balance in red, thin red inset outline).
