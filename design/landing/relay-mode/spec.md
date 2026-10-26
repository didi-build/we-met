# Landing: relay mode (How it works step 3)

Design-only spec. Approved MagicPath: [mightily-pool-9528](https://designs.magicpath.ai/v1/mightily-pool-9528) (project `464794193328484352`, component `464795539058352128`), revision `464985214758825984`. Approved by Diadem, Oct 25, 2026, 1:33 AM ET (variant A). Ticket: [DIDI-822](https://linear.app/didi-build/issue/DIDI-822). Questions: [DIDI-826](https://linear.app/didi-build/issue/DIDI-826). Owner setting for direct mode: [DIDI-831](https://linear.app/didi-build/issue/DIDI-831) (not built).

## Purpose

The landing described the direct flow ("you both get each other's details", one "New lead" email). Relay is the default, so the hero lead and How it works now tell the relay story: the visitor exchanges details and saves your card on the spot, and you get two emails, the "Great meeting you" letter (send it on by hitting Reply) and "You met" with every detail. Direct mode appears as the option. While DIDI-831 is unbuilt, the direct view's step 3 chip is a **Coming soon** badge, shown only when Direct is toggled on.

## Product direction (DIDI-739 locked block)

> | Mode | Visitor letter ("Great meeting you, {first}", vCard, no visitor details) | Owner email ("You met {name}", all details) |
> | --- | --- | --- |
> | owner_relay (default) | To the owner | To the owner |
> | direct | To the visitor | To the owner |

**Matches Product direction: yes.**

## Decisions (verbatim, locked by CTO on DIDI-739)

| # | Question | Diadem | Applied as |
| --- | --- | --- | --- |
| Q1 | Owner switch to direct | "owners get a setting, so A. I will build that out soon (when our inbox is warmed up and we have paying customers)" and, at 1:39 AM ET, "the landing page should say direct mode (the way it appears in the design). but let's add a "coming soon" badge on that feature. the badge should be on the page in a way that removing it doesn't affect anything else in the layout" | Direct line, Relay/Direct switch and direct state are kept as designed. A "Coming soon" badge shows in the direct view only (see 1:50 AM below). No "More delivery options" hint. |
| Q1 follow-up | Badge and direct-view copy | 1:50 AM ET: "please make that fix. plus one more: the coming soon badge appears either relay or direct is toggled on. and the way it's positioned makes it look like the entire step 3 is coming soon. let's only show that badge when direct is toggled on" | Direct-view step 3 title "Your copy lands in your inbox" and a one-email body. The badge renders only in direct. |
| Q1 follow-up | Badge style | 1:59 AM ET: "the coming soon badge should be formatted the same way as the ship it's replacing (aka match the relay's chip)" | "Coming soon" is a regular `.lp-chip`, same as relay's chip; only the text differs. |
| Q1 follow-up | Repeated wording, chip | 1:55 AM ET: "yes one of them replace with "directly to their inbox" and specialty the chip, put "coming soon" there instead" | Direct-mode line now says "goes directly to their inbox". In the direct view, the chip slot is the Coming soon badge, the only one on the page. |
| Q2 | How the owner sends it on | "2: hit Reply" | "To send it on, just hit Reply."; letter tag "Hit Reply to send" |
| Q3 | Card reaches the visitor | "3: yes, the card must reach them when I hit Reply" | CTO line verbatim: "When you hit Reply, your contact card goes with it, so they can save you in one tap." Never "attached". Superseded 2026-10-25, 11:34 PM ET (see Changes). |
| Q4 | We Met sends the visitor nothing | "4: yes, say We Met sends the visitor nothing" | "We Met sends them nothing, so the letter waits for you until you send it on." |
| Q5 | On-screen save | "5: yes, save my card is live in both modes" | Step 2: "...and saves your contact card on the spot." |
| Q6 | Subject | "6: Great meeting you, {first}" | "Great meeting you, Sam" |

## States

| State | Trigger | Step 3 title / chip | Step 3 notes | Vignette | Badge |
| --- | --- | --- | --- | --- | --- |
| Relay (default) | page load | Two emails land in your inbox / You choose when the letter goes | Reply note, nothing-sent note, direct line | Your inbox · 2 new: "Great meeting you, Sam" + "You met Sam Rivera" | never rendered |
| Direct (preview of the option) | tap "Direct" on the switch | Your copy lands in your inbox / chip slot = **Coming soon** badge | Direct-state line only | Your inbox · 1 new: "You met Sam Rivera"; Sam's inbox: "Great meeting you, Sam" | in the chip slot, when `SHOW_DIRECT_COMING_SOON` is true (ship default until DIDI-831); flag off = empty slot, same height |

The switch only changes the illustration on the landing page; it doesn't change any setting.

## Final copy

Unchanged: header, eyebrow "Free digital business card", H1 "Meet someone. / Swap details. / Easy.", "Get started →", "See an example", How it works heading and intro, step 1, final CTA, footer.

| Slot | Copy |
| --- | --- |
| Hero lead | Share one link or QR code. They save your card on the spot, and you get a follow-up letter ready to send, plus all their details, in your inbox. |
| Step 2 title / chip | They exchange contact details / No app needed |
| Step 2 body | The person you met taps Exchange contact, adds their name and email, and saves your contact card on the spot. |
| Step 3 title (relay) | Two emails land in your inbox |
| Step 3 body (relay) | A "Great meeting you" letter for them, ready to send on, and a "You met" email with every detail they shared, just for you. |
| Step 3 chip (relay) | You choose when the letter goes |
| Step 3 title (direct view) | Your copy lands in your inbox |
| Step 3 body (direct view) | The "Great meeting you" letter goes straight to them. Your copy, "You met", comes to you with every detail they shared. |
| Step 3 chip (direct view) | none; the chip slot holds the Coming soon badge |
| Note: Reply (relay) | To send it on, just hit Reply. When you hit Reply, they can save your contact card. |
| Note: nothing sent (relay) | We Met sends them nothing, so the letter waits for you until you send it on. |
| Note: direct (relay) | Prefer it automatic? Switch to direct and the letter goes straight to them. |
| Note (direct state) | Direct mode: the letter goes directly to their inbox, and you still get "You met" with all the details. |
| Switch | Relay (default) / Direct |
| Badge (direct view only, in the step 3 chip slot) | Coming soon |
| Meta description (description and og:description) | A free digital business card. Share one link or QR code, they save your card on the spot, and you get a follow-up letter plus all their details. |
| Share image alt (og:image:alt) | We Met: free digital business cards |

Curly quotes around "Great meeting you" and "You met". No em dashes.

## Vignette layouts

- **Step 1:** unchanged QR + URL card (`ShareLinkVignette`).
- **Step 2:** unchanged exchange sheet (`ExchangeFormVignette`): "Let's stay in touch", Full name Sam Rivera, Email sam@studio.co, "Exchange contact".
- **Step 3, relay:** inbox card (20px radius, 1px `--line` border, max width 380px). Head "Your inbox" + count pill "2 new". Rows separated by 1px `--line`, each with a 32px WM avatar, meta "We Met" / "now", unread dot + subject, a two-line clamped snippet, and tags:
  - "Great meeting you, Sam" · "Hi Sam, great meeting you, and thanks for sharing your details with me." · solid tag with reply arrow "Hit Reply to send" · soft tag with card icon "They can save your card".
  - "You met Sam Rivera" · sam@studio.co · Product designer · Studio Co · "Met at the design meetup" · outline tag "All the details, just for you".
- **Step 3, direct:** the inbox shows "1 new" with only the "You met" row. Below it is the label "Sam's inbox" (no badge), then a card with the letter row: soft YN avatar, "Your Name via We Met", tags "Contact card" (soft) and "Sent to Sam".
- **Desktop (≥860px):** the vignettes live in the existing sticky panel; mockups are captured with `?static=1`, which shows each step's vignette inline for review.

## Coming soon badge

Rules:
1. Render it only when Direct is toggled on. In relay it isn't rendered, and relay keeps its text chip "You choose when the letter goes".
2. In the direct view it IS step 3's chip: it sits in the chip slot, styled exactly like relay's step 3 chip (same `.lp-chip` class: `--surface-2` fill, no border, 999px radius, 6px 14px padding, Figtree 15px weight 500, `--ink` text, no icon). Only the text differs. It's the only "Coming soon" on the page; nothing in the vignette, by the switch or near the header.
3. One element behind one flag: `SHOW_DIRECT_COMING_SOON` (true until DIDI-831 ships an owner setting). To remove it, flip the flag or delete the span.
4. No layout shift: in direct, the chip slot is always rendered full width at the exact height of a chip (36px), so its box is the same with or without the chip inside. With the flag off, the slot stays empty and keeps its space.

Markup and CSS:
- Direct view chip row: `<ul className="lp-chips"><li className="lp-chip-slot">{SHOW_DIRECT_COMING_SOON && <span className="lp-chip" data-slot="direct-coming-soon">Coming soon</span>}</li></ul>`. Relay keeps `<li><span className="lp-chip">You choose when the letter goes</span></li>`.
- `.lp-chip-slot { position: relative; width: 100%; height: 36px; }` (36px = 6px + 15px x 1.6 + 6px, the text chip's height).
- `.lp-chip-slot { width: 100%; height: 36px; }`. No badge-specific style: the chip is `.lp-chip`.
- Verified at 390px and 1280px: relay and direct chips have 0 differing computed properties, both 36px tall at the same x ([mockups/A-final-chip-compare-relay-vs-direct.png](mockups/A-final-chip-compare-relay-vs-direct.png)).
- If the chip font size or padding changes, update the slot height to match.

Verified at 390px and 1280px in headless Chrome:
- The step 3 chip row is 36px in relay, in direct with the badge, and in direct without it.
- Relay is pixel-identical to the previous revision.
- Direct with vs without the badge: identical element boxes and page heights, and the pixel difference is limited to the badge box.
- Toggling Relay, then Direct, then Relay restores the layout exactly.

## Mockups

| State | Phone (390, 2x) | Desktop (1280) |
| --- | --- | --- |
| Relay (no badge) | [mockups/A-final-phone-relay.png](mockups/A-final-phone-relay.png) | [mockups/A-final-desktop-relay.png](mockups/A-final-desktop-relay.png) |
| Direct, badge | [mockups/A-final-phone-direct-badge.png](mockups/A-final-phone-direct-badge.png) | [mockups/A-final-desktop-direct-badge.png](mockups/A-final-desktop-direct-badge.png) |
| Direct, no badge (empty chip slot) | [mockups/A-final-phone-direct-no-badge.png](mockups/A-final-phone-direct-no-badge.png) | [mockups/A-final-desktop-direct-no-badge.png](mockups/A-final-desktop-direct-no-badge.png) |

Reference source (MagicPath export, static, not built by CI): [reference/](reference/) with a `.txt` suffix.

## Implementation notes

- `src/components/landing/LandingHome.tsx`: hero lead.
- `src/components/landing/how-it-works-steps.tsx`: step 2 body; step 3 title, body and chip per state (direct: the chip slot with the badge); step 3 notes and the switch (a client component, because the switch holds state, and step 3 copy depends on it).
- `src/components/landing/HowItWorksVignettes.tsx`: replace `LeadEmailVignette` with the two-row inbox (relay) and the direct-state layout; delete `VisitorEmailVignette`.
- `src/components/landing/landing.css`: add `.lp-inbox*`, `.lp-tag*`, `.lp-mode*`, `.lp-chip-slot`, `.lp-note`, `.lp-dot` from the reference CSS (the DIDI-822 additions block).
- `test/landing/how-it-works.test.tsx` and `landing-home.test.tsx` assert the old strings; update them.
- Update `design/landing/index.html` too: it still has the old "You both get an email" step 3 and a privacy section that isn't on the live page.
- Keep "attached" out of all landing copy.

## Changes

- 2026-10-24: Design pass, three variants (A, B, C) plus baseline ([DIDI-822](https://linear.app/didi-build/issue/DIDI-822)).
- 2026-10-25, 1:33 AM ET: Diadem approves variant A.
- 2026-10-25: Final copy applies the DIDI-826 answers Q1 to Q6 (Reply to send on, card goes with the reply, We Met sends the visitor nothing, "Great meeting you, {first}"); "attached" removed. Revision `464979057809965056` (relay only, with a hint slot) superseded the same night.
- 2026-10-25, 1:39 AM ET: Diadem keeps direct mode as designed, with a "Coming soon" badge that causes no layout shift; no "More delivery options" hint. Final revision `464982756636639232`.
- 2026-10-25, 1:50 AM ET: Diadem: "please make that fix. plus one more: the coming soon badge appears either relay or direct is toggled on. and the way it's positioned makes it look like the entire step 3 is coming soon. let's only show that badge when direct is toggled on". The direct view's step 3 title is now "Your copy lands in your inbox", its chip "The letter goes straight to them", and its body describes one owner email. The badge now renders in direct only, moved from beside the switch to the "Sam's inbox" label row. Revision `464982756636639232` (supersedes `464979824746848256`).
- 2026-10-25, 1:55 AM ET: Diadem: "yes one of them replace with "directly to their inbox" and specialty the chip, put "coming soon" there instead". Direct view only: the direct-mode line now reads "Direct mode: the letter goes directly to their inbox, and you still get "You met" with all the details."; step 3's chip "The letter goes straight to them" is replaced by the Coming soon badge, in a fixed-height chip slot; the badge on the "Sam's inbox" label is removed, so there's one Coming soon on the page. Relay is unchanged. Final revision `464983961865691136` (supersedes `464982756636639232`).
- 2026-10-25, 1:59 AM ET: Diadem: "the coming soon badge should be formatted the same way as the ship it's replacing (aka match the relay's chip)". The direct view's "Coming soon" is now a regular `.lp-chip`, identical to relay's "You choose when the letter goes" chip apart from the text (no icon, as relay has none); `.lp-soon-badge` is removed. Still one element behind `SHOW_DIRECT_COMING_SOON`, no layout shift. Final revision `464985214758825984` (supersedes `464983961865691136`).
- 2026-10-25, 11:01 PM ET: Diadem approved the meta description and share image alt (verbatim "Yes to both"), replacing the old direct-mode description "you both get each other's details" and the em-dash alt; design/landing/index.html brought in line with this spec ([DIDI-823](https://linear.app/didi-build/issue/DIDI-823)).
- 2026-10-25, 11:34 PM ET: Diadem: "something like: When you hit Reply, they can save your contact card". The step 3 relay Reply note now reads "To send it on, just hit Reply. When you hit Reply, they can save your contact card." (was "...your contact card goes with it, so they can save you in one tap.") ([DIDI-823](https://linear.app/didi-build/issue/DIDI-823)).
- 2026-10-25, 11:41 PM ET: Diadem: "b" (change the inbox tag to 'They can save your card'). The step 3 inbox illustration soft tag now reads "They can save your card" (was "Your card goes with it") ([DIDI-823](https://linear.app/didi-build/issue/DIDI-823)).
