# WeMetButton

**Status:** Approved for gallery seed (maps to `src/components/ui/Button.tsx` in the app).

## Purpose

Primary and secondary actions on landing and card flows. Gallery implementation lives in `components/we-met-button/`; the app uses `src/components/ui/Button.tsx`.

## Variants

| Variant | Use                                    |
| ------- | -------------------------------------- |
| Primary | Main call to action (Continue, Submit) |
| Outline | Secondary or low-emphasis actions      |

## Props

| Prop       | Type                       | Default     | Notes                     |
| ---------- | -------------------------- | ----------- | ------------------------- |
| `children` | React node                 | (required)  | Visible button label      |
| `variant`  | `"primary"` \| `"outline"` | `"primary"` | Visual style              |
| `disabled` | boolean                    | `false`     | Native disabled when true |

## Accessibility

- Native `<button type="button">` unless `type` is overridden by caller
- Focus ring uses accent outline (see mono palette tokens)
- Disabled state uses the `disabled` attribute

## QA checklist

- [ ] Primary uses accent fill and accent-ink text
- [ ] Outline uses ink border and hover fill
- [ ] Disabled does not respond to click
