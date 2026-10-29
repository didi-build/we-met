# Gallery guard accepted gaps

Additional accepted gap (see block comment in [`scripts/lib/check-gallery-guards-lib.mjs`](../scripts/lib/check-gallery-guards-lib.mjs) for the rest):

- YAML folded or plain-scalar split without a backslash (`wrangler.gal` with `lery.jsonc` on the next line) folds to two shell words and is not a resolvable config path, so it is not flagged.
