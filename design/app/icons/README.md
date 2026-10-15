# App icons

All icons except google-g use `currentColor`. index.html references them as `<span class="ap-icon" data-icon="<name>" data-size="<px>">`; app.js fetches `icons/<name>.svg`, inlines it, sets the size and makes mask ids unique. Serve over http(s).

- `we-met-mark`: 32 viewBox. Header brand 28; login 56. Masked tile, one mask id per instance (app.js renames it).
- `google-g`: 48 viewBox, shown at 20 in the Google button. Google brand colours, NOT currentColor; do not recolour.
- `sun / moon`: 24 viewBox, shown at 20 in the header theme button. Stroke 2.5.
- `close`: 24 viewBox, 20. Dialog close.
- `plus`: 16 viewBox, 16. Add paragraph, add service.
- `check`: 24, 16. Slug available, Saved, Copied.
- `alert`: 24, 16. Field errors, slug taken/invalid/reserved, alerts.
- `arrow-up / arrow-down`: 24, 18. Reorder services (44 buttons).
- `trash`: 24, 18. Delete paragraph, service, photo.
- `copy`: 24, 18. Copy link.
- `external`: 24, 18. Open card.
- `camera`: 24, 18. Upload photo.
- `link`: 24, 18. Alternate link section.
- `mail`: 24, 18. Leads line.
- `zoom-out / zoom-in`: 24, 20. Crop zoom slider ends.
- `website / linkedin / github / instagram`: 24, 18. Link field prefixes. Same files as design/card/icons.
- `person`: 32 viewBox, filled, shown at 32 filling the account circle. The body runs off the bottom and is clipped by the circle (overflow hidden), so it follows the curve.
- `lock / unlock`: 24, 18. Card address locked / unlocked.
- `chevron-down`: 24, 20. Section collapse toggles (below 900px). Rotates -90° when collapsed.
- `share`: 24, 18. Share card button in the bottom bar.
