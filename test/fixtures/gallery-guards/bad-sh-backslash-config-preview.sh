#!/usr/bin/env bash
set -euo pipefail
npx wrangler preview --config wrangler.gal\
lery.jsonc --worker-name we-met --ignore-base-config --name gallery-pr-evil --json
