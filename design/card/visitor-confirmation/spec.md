# Visitor confirmation (Variant C Receipt)

**Design source:** [MagicPath share](https://designs.magicpath.ai/v1/breezily-wave-1846), revision `464207773454995457`

## Purpose

On the public card (`/hi/<slug>`), right after a visitor completes **Exchange contact** (step 1), show the owner's contact details on the card without waiting for email: a compact receipt, **Save contact**, and tappable **Email** / **Call**. Optional details (step 2) stay in the existing sheet. After reload or when the exchange session is gone, fall back to today's quiet sent state.

Mobile first at **390px** width (`max-w-[420px]` page shell). **Figtree**, monochrome **mono** palette only (`src/theme/tokens/mono.light.css`, `mono.dark.css`). Pill buttons, **24px** card radius, thin borders, **no shadows** on the receipt block (card shell unchanged). Red only for errors elsewhere.

## Variant C Receipt

Replace the post-exchange **disabled "Contact sent"** button and thanks line under the CTA with the receipt stack (see mockups).

| Mockup | File | Meaning |
| --- | --- | --- |
| Today (baseline) | [mockups/baseline.png](./mockups/baseline.png) | Disabled **Contact sent** + thanks or follow-up copy |
| C Receipt (before details) | [mockups/c.png](./mockups/c.png), [mockups/mp-c.png](./mockups/mp-c.png) | Receipt + Save + Email/Call + "Tell more" |
| C Receipt (after details) | [mockups/c-after-details.png](./mockups/c-after-details.png) | Receipt with **With your note** + thanks line |
| C Receipt (dark) | [mockups/c-dark.png](./mockups/c-dark.png) | Same as before-details, dark theme |
| After reload | [mockups/after-reload.png](./mockups/after-reload.png) | Baseline-style fallback when session is lost |

Static MagicPath exports (not built by CI): [reference/variant-c-magicpath.tsx.txt](./reference/variant-c-magicpath.tsx.txt), [reference/kit.tsx.txt](./reference/kit.tsx.txt), [reference/wm.css.txt](./reference/wm.css.txt).

## States and behaviour

### Default (no exchange yet)

Unchanged: **Exchange contact** primary button with ring animation, optional alternate link, existing card body.

### Receipt (active exchange session)

**When:** Step 1 exchange succeeded in this tab and a valid exchange session exists (see persistence). Sheet may still be open for step 2; receipt is visible on the card when the sheet is closed.

**Hide:** Legacy thanks line under the CTA (`Thanks, {firstName}. Talk soon.`) while the receipt is shown.

**Sticky exchange bar:** Hidden while receipt or reload fallback is shown.

**Layout:** Single column, `flex flex-col gap-3`, enter with `animate-hi-fade` (0.25s ease-out, see `src/app/globals.css`).

#### Receipt pill

- Container: `flex items-center justify-between gap-3 rounded-pill border border-line px-4 py-2`
- Left (`role="status"`): check icon 16px + label **Sent to {ownerFirst}** (`text-[14px] font-semibold text-ink`, icon gap `gap-1.5`)
- Right: **Just now** or **With your note** (`text-[13px] font-medium text-ink-muted`)
- **With your note** when optional details were submitted on this device (existing `details-sent` localStorage flag)

#### Save contact (primary)

Use shared `Button` (`src/components/ui/Button.tsx`):

- Default variant **primary**: `min-h-14 w-full text-[17px]` on top of button base (`min-h-11`, `rounded-pill`, `gap-3`, `font-semibold`, `bg-accent` / `text-accent-ink`, hover `accent-hover`)
- Icon: contact card outline, 20px, before label
- Label: **Save {ownerFirst}'s contact** (`ownerFirst` = first token of `card.name`)
- **Busy:** `aria-busy={true}`, 16px spinning ring (`border-2 border-current border-t-transparent`), label **Preparing contact**, ~400ms minimum
- **Saved:** switch to **outline** variant (`border-[1.5px] border-ink`), check icon 20px, label **Saved, tap to save again**; tap runs save again

**vCard behaviour:**

- **Ship target:** normal form **POST** returning `text/vcard` attachment, gated by exchange `leadToken` (~2h, same tab). iOS Safari shows Add to Contacts.
- Public `/hi/<slug>/contact.vcf` remains closed ([DIDI-641](https://linear.app/didi-build/issue/DIDI-641)).
- Filename pattern: `{sanitized-full-name}.vcf` (non-alphanumeric stripped, spaces to hyphens, fallback `contact.vcf`).

#### Email and Call (secondary row)

- Grid: `grid grid-cols-2 gap-2`
- Each link matches outline button styling: `min-h-12 w-full px-4 text-[15px] font-semibold`, plus `inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-pill border-[1.5px] border-ink bg-transparent text-ink no-underline transition-colors hover:bg-ink hover:text-bg`
- **Email:** mail icon 18px + **Email**, `href="mailto:{card.email}"`
- **Call:** phone icon 18px + **Call**, `href="tel:{normalized}"` using same normalization as `leadPhoneTel()` in `src/email/email-template-vars.ts`
- If owner has no phone: second cell is empty placeholder `min-h-12 rounded-pill border border-dashed border-line` (`aria-hidden`)

#### Contact line

- Centered: `{email}` or `{email} · {phone}` (`text-[14px] leading-normal text-ink-muted`, middle dot separator)

#### Follow-up line

- Centered: **{ownerFirst} will follow up by email.** (`text-[15px] font-medium leading-normal text-ink-muted`)

#### Optional details link (before details sent)

- `button type="button"`: `mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-pill px-2 text-[14px] font-medium text-ink-muted underline decoration-1 underline-offset-[3px] hover:text-ink`
- Note icon 16px + **Tell {ownerFirst} more about you**
- Opens existing exchange sheet on **details** step (`initialStep` when `connected`)

#### After details thanks (details sent on device)

- Replace link with paragraph: `animate-hi-fade text-center text-[14px] font-medium text-ink-muted`
- Copy: **Your details were added. Thanks, {visitorFirst}.** (`visitorFirst` from exchange step 1, fallback **there**)

### Reload fallback (exchange completed, no session)

**When:** `localStorage` records exchange completed for this slug but `sessionStorage` has no session (reload, new tab, or token window ended).

**UI:**

- Disabled primary **Contact sent** (`HI_CONTACT_SENT_BUTTON_LABEL`, `min-h-14 w-full text-[17px] font-semibold`)
- Line below: **{ownerFirst} has your details and will follow up by email.** (`mt-1 text-center text-[14px] font-medium leading-normal text-ink-muted`)

**Interaction:** Do not open exchange sheet from CTA or sticky bar.

## Copy templates

`{ownerFirst}` = first word of owner display name. `{visitorFirst}` = visitor first name from exchange.

| Key | Template |
| --- | --- |
| Sent pill | `Sent to {ownerFirst}` |
| Receipt time (before details) | `Just now` |
| Receipt time (after details) | `With your note` |
| Save CTA | `Save {ownerFirst}'s contact` |
| Save busy | `Preparing contact` |
| Save done | `Saved, tap to save again` |
| Email / Call | `Email`, `Call` |
| Follow-up | `{ownerFirst} will follow up by email.` |
| Tell more | `Tell {ownerFirst} more about you` |
| After details | `Your details were added. Thanks, {visitorFirst}.` |
| Reload fallback | `{ownerFirst} has your details and will follow up by email.` |
| Reload button | `Contact sent` (existing constant) |

Example fixture (MagicPath): owner **Maya Chen**, visitor **Sam**, email `maya@northwind.studio`, phone `+1 416 555 0142`.

## Styling tokens (mono palette)

Map Tailwind theme utilities to CSS variables on `[data-palette="mono"]`:

| Utility | Variable | Light | Dark |
| --- | --- | --- | --- |
| `bg-bg` | `--bg` | `#fafafa` | `#0f0f0f` |
| `bg-surface` | `--surface` | `#ffffff` | `#181818` |
| `border-line` | `--line` | `#dedede` | `#333333` |
| `text-ink` | `--ink` | `#161616` | `#f2f2f2` |
| `text-ink-muted` | `--ink-muted` | `#555555` | `#ababab` |
| `bg-accent` / primary button | `--accent` | `#161616` | `#f2f2f2` |
| `text-accent-ink` | `--accent-ink` | `#fafafa` | `#0f0f0f` |
| `hover:bg-accent-hover` | `--accent-hover` | `#383838` | `#cecece` |

Dark mode: document `data-theme="dark"` on `html` (existing hi card theme switch). Outline buttons invert on hover (`hover:bg-ink hover:text-bg`).

## Icons (stroke 1.8, 24 viewBox)

Implement inline SVGs (see reference kit): check, mail (envelope), phone, contact card (person on card), note (speech bubble with lines). Sizes as listed per control.

## Persistence

| Store | Key pattern | Set when | Used for |
| --- | --- | --- | --- |
| `sessionStorage` | `we-met-hi-exchange-session:{slug}` JSON `{ firstName, leadToken }` | Exchange step 1 success | Receipt UI in same tab |
| `localStorage` | `we-met-hi-exchange-completed:{slug}` = `1` | Exchange step 1 success | Reload fallback |
| `localStorage` | `we-met-hi-details-sent:{slug}` = `1` (existing) | Details step success | **With your note**, after-details copy, block re-opening sheet |

**Receipt visible when:** `connected && leadToken` from session.  
**Reload fallback when:** exchange-completed flag set and no session token.

On exchange success: set session + exchange-completed flag, keep `connected` / `firstName` / `leadToken` in React state.

## Accessibility

- Receipt status: `role="status"` on **Sent to {ownerFirst}** pill left cluster.
- Save: `aria-busy` while preparing; disabled state not used for save (outline replays save).
- Email/Call: real links with visible text; icons `aria-hidden`.
- Tell more: native `button`, underline signals action.
- Reload: disabled button with `aria-disabled`, follow-up text not duplicated in `aria-live` unless sheet already uses status region.
- Focus: opening details from receipt should move focus into sheet per existing sheet behaviour.

## Implementation notes

1. **vCard download:** wire Save to token-gated POST (not client-only `buildVCard` blob). Until then, integration tests should not rely on a public vcf URL.
2. **Token expiry:** receipt should degrade to reload fallback when POST returns 401/403; align with ~2h exchange token TTL.
3. **Sticky bar:** hidden during receipt/fallback; confirm with product if a compact save affordance is needed when scrolled.
4. **Pro/free plans:** receipt replaces only the CTA block inside `HiCardPresentation`; banner and card body unchanged.
5. **Preview/editor:** `preview` mode keeps static **Exchange contact** (no receipt).
6. **Tests:** unit tests for copy helpers, receipt states, session vs reload flags; extend `HiPageClient` tests for the three CTA modes.

## Changes

- 2026-10-22: Initial spec, variant C Receipt ([DIDI-742](https://linear.app/didi-build/issue/DIDI-742)). Built in DIDI-746.
