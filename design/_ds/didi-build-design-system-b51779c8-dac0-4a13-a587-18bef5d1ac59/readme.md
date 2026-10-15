# Didi Build design system

Didi Build is the solo consultancy of Diadem (Didi) Shoukralla, a Toronto software engineer who helps small businesses find where AI can save time or make money, then builds it. The only product surface today is the one-page marketing site **didi.build**: hero, examples of work, a three-step process, a contact form, FAQ, About, footer. Audience: small-business owners who are not technical and are wary of hype.

## Sources
- `web.dc.html` (project root): the design file the live site was built from, including the redesigned FAQ / About / footer transition. Source of truth for every token and component here.
- `uploads/screenshot page.png`: full-page screenshot of the live site.
- Live site: https://didi.build (not fetched). Portfolio: https://portfolio.didi.build

## Content fundamentals
- **Voice:** first person singular ("I learn how you work first"), speaking to "you" and "your business". One person, not an agency: never "we" for Didi.
- **Tone:** calm, plain, reassuring, a little warm. Concrete over clever. Admits limits ("If AI isn't a good fit, I'll tell you.").
- **Plain English, no jargon.** No "leverage", "solutions", "LLM", "agents", "transform". Describe outcomes in the customer's terms: "A calmer inbox", "Paperwork that reads itself", "Never lose a lead".
- **Promises are specific and bounded:** "free 30-min chat", "reply within 2 business days", "fixed price, fixed scope", "no surprise bills".
- **Casing:** sentence case for everything, including eyebrows, buttons and headings. No all-caps, no Title Case.
- **Punctuation:** headings end with a period when they are sentences. No em dashes; use commas, colons or a new sentence. Contractions are fine (I'll, don't, isn't).
- **Errors** are one kind sentence that tells the user what to do: "That email doesn't look quite right. Check for a typo?" Failures take the blame: "Something went wrong on my end, and your text is still here."
- **CTAs:** verb-first and literal: "Book a free 30-min chat", "Send message", "See how it works". A trailing → only on the main hero CTA.
- **No emoji.** Only glyphs used: → on the primary CTA, ✓ in the success disc, ! in error markers.

## Visual foundations
- **Palette:** a single green family on warm off-white (light) or deep green-black (dark), all in OKLCH with hues 120-160. Neutrals are tinted green, never grey. Accent green is for the one primary action, eyebrows, numerals and links. Red appears only for errors. See `tokens/colors.css`.
- **Themes:** light and dark are equal citizens. Default follows `prefers-color-scheme`; the header toggle overrides. Set `data-theme` on a wrapper. In dark, accent becomes a light mint and leaf colours invert order so the brightest leaf still reads first.
- **Type:** Figtree only (400/500/600/700). Headings are 600 with tight negative tracking (-0.03em display to -0.01em cards) and `text-wrap: balance`; body 17px/1.6 with `text-wrap: pretty`. The display h1 carries a second line in accent green at 0.56em. JetBrains Mono appears only in utility placeholders. Sizes are fluid via `clamp()` with container units (`cqi`); the page root has `container-type: inline-size`.
- **Layout:** 1168px container, fluid gutters 20-48px, section padding 56-112px. Recurring pattern: two columns that wrap on narrow screens, heading + intro on the left (flex 1, min 320px), content on the right (flex 1.3, min 440px). Section intros cap at 18-20ch headings and 40-46ch body.
- **Backgrounds:** flat colour only. Sections alternate page `--bg` and a slightly deeper `--surface-2` band (How it works, FAQ). No gradients, no photos, no textures, no patterns.
- **Illustration:** hand-feeling vines generated in SVG, one bezier stem with alternating almond leaves in three greens, each leaf with a faint centre vein. One vine per section, alternating sides, and they deliberately break boundaries: spilling into the page margin, hanging over a band edge, growing out of the About panel down to the footer rule. They are decorative (aria-hidden) and never carry meaning.
- **Cards:** flat. `--surface` fill, 1px `--line` border, 24px radius, 28px padding. The warm variant (SoftPanel) is borderless `--accent-soft`. No shadows anywhere in the system.
- **Rules and borders:** structure comes from lines. 2px ink rule above steps and under the FAQ toolbar; 1px `--line` between list rows and above the footer; 1.5px ink outline on secondary buttons; 1px `--line-strong` on form fields.
- **Radii:** 8 (small utility), 12 (fields), 14 (alerts), 24 (cards, panels), 999 (all buttons, chips, icon buttons). The leaf mark uses 14px 2px 14px 2px.
- **Controls:** everything is a pill. Primary: filled accent, 56px. Secondary: 1.5px ink outline, 44-48px. Minimum hit target 44px.
- **Hover:** primary darkens (`--accent-hover`); outline buttons invert (fill ink, text bg); icon buttons get a `--surface-2` fill; text links go from accent to ink; FAQ questions go from ink to accent. **Press:** no scale or shrink. **Focus:** 3px accent outline, 3px offset; fields use an accent border plus 2px accent ring instead.
- **Motion:** quiet and short (.15-.3s) for UI; one expressive moment for vines (stem draws over 1.9s, leaves pop in with a slight overshoot). Accordion height animates via grid rows. Everything turns off under reduced motion.
- **Transparency / blur:** none, apart from the leaf vein stroke at 40% opacity and placeholder text at 75%.
- **Imagery:** no photography or stock imagery. If a photo is ever added, it should be warm, natural light, and sit in a 24px-radius frame.

## Iconography
- Almost icon-free by intent. Brand glyphs are built in CSS: the leaf mark, the theme toggle's half-filled circle, the accordion plus/minus.
- Three footer SVGs, copied from the source into `assets/icons/`: portfolio (person, 2px stroke, round caps), GitHub and LinkedIn (filled brand marks). They render at 19-20px in `currentColor` inside 44px ghost IconButtons.
- No icon font and no CDN icon set. If more icons are needed, use a 2px-stroke, round-cap outline set (Lucide is the closest match) and flag it.
- No emoji. Unicode only for →, ✓ and !.

## Logo
There is no logo file. The lockup is the CSS leaf mark plus "Didi Build" in Figtree Bold (see `Logo` component). Do not draw other marks.

## Index
- `styles.css`: entry point (imports only). `tokens/`: fonts, colors, typography, spacing, motion, base.
- `guidelines/`: foundation specimen cards; `_loader.js` is a preview helper for cards, not part of the system.
- `assets/vines/`: the five vine placements as static SVG, light + dark. `assets/icons/`: footer icons.
- `components/`
  - core: Button, IconButton, ThemeToggle, Chip, Badge, LeafMark, Logo
  - content: Eyebrow, Heading, ExampleCard, Step, SoftPanel
  - disclosure: Accordion
  - forms: TextField, Alert
  - illustration: Vine
  - navigation: SiteHeader, SiteFooter
- `ui_kits/website/`: interactive recreation of didi.build.
- `web.dc.html`: the original page design. `FAQ About Preview.dc.html`: mobile mockups from the FAQ/About redesign.
- `SKILL.md`: Agent Skill manifest.

## Intentional additions
No component library existed; every component above is extracted 1:1 from patterns on the page. `Heading` and `SoftPanel` are named wrappers for repeated inline patterns rather than new designs.

## Caveats
- Fonts load from Google Fonts; no font binaries are bundled.
- FAQ answers in the kit are placeholders.
