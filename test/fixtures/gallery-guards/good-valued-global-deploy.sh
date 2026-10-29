#!/usr/bin/env bash
set -euo pipefail
npx wrangler --x-provision false deploy --config wrangler.jsonc
