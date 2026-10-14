# PayCheck logo

Lem picked these on Oct 14 (thread "logo"). Concept page: [concepts.html](concepts.html) (hosted: https://claude.ai/artifact/WDJoEpY67dNyUdK5ZeFgjd)

- **Primary: K, "P Bill".** A straight blue bill with the P in a white centre seal and a small gold coin stack on the right, whose bottom sits just below the bottom of the bill. Use for the app icon, splash and store listing.
- **Secondary: A, "Split Ring".** The payday ring (gold = saved, blue = spend) with a P in the middle. Use for small in-app spots, the header, or anywhere the bill is too wide.

Colours are Harbour Gold (see [../harbour-gold-spec.md](../harbour-gold-spec.md)): bill = `spend`, coins = `accent` with a darker side, P = navy `#13203a`. On dark, use the dark-palette files.

## Files

| File | Use |
| --- | --- |
| `concepts.html` | All fourteen concepts (A to N) on light and dark and as app icons |
| `primary-K-icon-1024.png` | Expo `icon` (square, full-bleed navy; the phone rounds the corners) |
| `primary-K-icon.svg` / `-icon-light.svg` | Rounded app icon, navy or white |
| `primary-K-mark-light.svg` / `-mark-dark.svg` | Mark alone, transparent, for light or dark backgrounds |
| `secondary-A-*` | Same set for the ring logo |

The wordmark is the mark followed by "Pay" in ink and "Check" in gold, Outfit SemiBold.

## In the app

The phone app's icons in `mobile/assets/` are made from the primary logo:

- `icon.png` is `primary-K-icon-1024.png`.
- `android-icon-foreground.png` is the dark mark scaled to fit Android's safe zone, on the navy `android-icon-background.png`. `android-icon-monochrome.png` is a white cut-out of it for themed icons.
- `splash-icon.png` and `splash-icon-dark.png` are the light and dark marks, shown on the light (`#f2f5fa`) or dark (`#0e1626`) background to match the phone's setting.
- `favicon.png` is the icon at 48 pixels.
