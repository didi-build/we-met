# Landing icons

All icons use `currentColor`. index.html references them as `<span class="lp-icon" data-icon="<name>" data-size="<px>">`; landing.js fetches `icons/<name>.svg`, inlines it, sets the size and gives each mask a unique id. Serve over http(s).

- `we-met-mark`: 32 viewBox. Header 26, footer 20, coming-soon page 56. Masked tile (one mask id per instance).
- `didi-build-leaf`: 12 viewBox, shown at 12 next to "Didi Build" in the footer. Colour: ink.
- `sun` / `moon`: 24 viewBox, 13 / 12 inside the footer switch knob. Stroke 2.5.
- `copy`: 24, 14. Link vignette (decorative).
- `contact-card`: 24, 12. Card tags in the step 3 inbox vignette (decorative).
- `reply`: 24, 12 in the "Hit Reply to send" tag, 10 in the step 3 Reply note dot. Stroke 2.2 (decorative).
- `qr-sample`: 21 viewBox, 104. Decorative QR pattern in the link vignette. Not a real code.

The hero CTA arrow is the text glyph → (U+2192), not an icon.
