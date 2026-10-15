# Card icons

All icons use `currentColor`, so colour comes from the parent text colour in card.css. card.html references them by name with `<span class="wm-icon" data-icon="<name>" data-size="<px>">`; card.js fetches `icons/<name>.svg` and inlines it (so currentColor works), sets width/height from data-size, and gives each mask a unique id. Serve the folder over http(s); browsers block fetch from file://.

- `we-met-mark.svg`: 32 × 32 viewBox. Shown at 16 (top strip), 14 (band, powered-by). Filled tile with cut-out face via mask; use a unique mask id per instance when inlined.
- `didi-build-leaf.svg`: 12 × 12. Powered-by row. Colour: accent (#161616 light / #f2f2f2 dark).
- `website.svg`: 24 viewBox, shown at 18. Outline, stroke 2, round caps/joins.
- `linkedin.svg`: 24 viewBox, shown at 18. Filled.
- `github.svg`: 24 viewBox, shown at 18. Filled.
- `instagram.svg`: 24 viewBox, shown at 18. Outline, stroke 2.
- `moon.svg`: 24 viewBox, shown at 12. Stroke 2.5. Toggle knob, dark on.
- `sun.svg`: 24 viewBox, shown at 13. Stroke 2.5. Toggle knob, dark off.
- `arrow-right.svg`: 24 viewBox, shown at 16. Stroke 2. Top strip and band button.
- `close.svg`: 24 viewBox, shown at 20. Stroke 2. Sheet close.
- `plus.svg`: 16 viewBox, shown at 12. Stroke 2. Chip; rotates 45° when open.
