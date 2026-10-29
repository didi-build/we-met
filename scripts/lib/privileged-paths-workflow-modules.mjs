/**
 * Exact repo paths reached from GitHub Actions workflow scripts (DIDI-973).
 * Each entry is one privileged-path matcher with an explicit infrastructure severity.
 *
 * @type {readonly { id: string; path: string; infrastructure: boolean }[]}
 */
export const workflowModuleExactPrivilegedEntries = [
  {
    id: "preview-login-guard",
    path: "scripts/lib/preview-login-guard.mjs",
    infrastructure: true,
  },
  {
    id: "assert-repo-root-output",
    path: "scripts/lib/assert-repo-root-output.mjs",
    infrastructure: true,
  },
  {
    id: "d1-id-resolution",
    path: "scripts/lib/d1-id-resolution.mjs",
    infrastructure: true,
  },
  {
    id: "provision-resources-lib",
    path: "scripts/lib/provision-resources.mjs",
    infrastructure: true,
  },
  {
    id: "cloudflare-provision-api",
    path: "scripts/lib/cloudflare-provision-api.mjs",
    infrastructure: true,
  },
  {
    id: "provision-run",
    path: "scripts/lib/provision-run.mjs",
    infrastructure: true,
  },
  {
    id: "provision-resources-script",
    path: "scripts/provision-resources.mjs",
    infrastructure: true,
  },
  {
    id: "bootstrap-lib",
    path: "scripts/lib/bootstrap.mjs",
    infrastructure: true,
  },
  {
    id: "bootstrap-script",
    path: "scripts/bootstrap.mjs",
    infrastructure: true,
  },
  {
    id: "dependabot-label-lib",
    path: "scripts/lib/dependabot-label.mjs",
    infrastructure: false,
  },
  {
    id: "ensure-dependabot-label",
    path: "scripts/ensure-dependabot-label.mjs",
    infrastructure: false,
  },
  {
    id: "verify-preview-nonprod-resources",
    path: "scripts/verify-preview-nonprod-resources.mjs",
    infrastructure: true,
  },
  {
    id: "preview-nonprod-resource-gate",
    path: "scripts/lib/preview-nonprod-resource-gate.mjs",
    infrastructure: true,
  },
  {
    id: "staging-d1-migration-drift-script",
    path: "scripts/staging-d1-migration-drift.mjs",
    infrastructure: true,
  },
  {
    id: "staging-d1-migration-drift-lib",
    path: "scripts/lib/staging-d1-migration-drift.mjs",
    infrastructure: true,
  },
  {
    id: "wrangler-preview-delete-script",
    path: "scripts/wrangler-preview-delete.mjs",
    infrastructure: true,
  },
  {
    id: "wrangler-preview-delete-lib",
    path: "scripts/lib/wrangler-preview-delete-lib.mjs",
    infrastructure: true,
  },
  {
    id: "check-google-oauth-client-ids",
    path: "scripts/check-google-oauth-client-ids.mjs",
    infrastructure: true,
  },
  {
    id: "google-oauth-client-id-smoke",
    path: "scripts/lib/google-oauth-client-id-smoke.mjs",
    infrastructure: false,
  },
  {
    id: "expand-only-lint",
    path: "src/migrations/expand-only-lint.ts",
    infrastructure: true,
  },
  {
    id: "verify-action-pins",
    path: "scripts/verify-action-pins.mjs",
    infrastructure: false,
  },
  {
    id: "deploy-production-advisory-lint",
    path: "scripts/deploy-production/advisory-lint.ts",
    infrastructure: true,
  },
  {
    id: "deploy-production-attribution",
    path: "scripts/deploy-production/attribution.mjs",
    infrastructure: false,
  },
  {
    id: "deploy-production-baseline",
    path: "scripts/deploy-production/baseline.mjs",
    infrastructure: true,
  },
  {
    id: "deploy-production-compare-migrations",
    path: "scripts/deploy-production/compare-migrations.mjs",
    infrastructure: true,
  },
  {
    id: "deploy-production-compare-pages",
    path: "scripts/deploy-production/compare-pages.mjs",
    infrastructure: true,
  },
  {
    id: "deploy-production-failure-classification",
    path: "scripts/deploy-production/failure-classification.mjs",
    infrastructure: true,
  },
  {
    id: "deploy-production-messages",
    path: "scripts/deploy-production/messages.mjs",
    infrastructure: false,
  },
  {
    id: "deploy-production-plan-soft-fail",
    path: "scripts/deploy-production/plan-soft-fail.mjs",
    infrastructure: true,
  },
  {
    id: "deploy-production-plan",
    path: "scripts/deploy-production/plan.ts",
    infrastructure: true,
  },
  {
    id: "deploy-production-report-setup-failure",
    path: "scripts/deploy-production/report-setup-failure.mjs",
    infrastructure: true,
  },
  {
    id: "deploy-production-workflow-output",
    path: "scripts/deploy-production/workflow-output.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-apply-guard",
    path: "scripts/migrate-nonprod/apply-guard.mjs",
    infrastructure: true,
  },
  {
    id: "migrate-nonprod-apply-output",
    path: "scripts/migrate-nonprod/apply-output.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-apply",
    path: "scripts/migrate-nonprod/apply.ts",
    infrastructure: true,
  },
  {
    id: "migrate-nonprod-comment-body",
    path: "scripts/migrate-nonprod/comment-body.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-gh-api-comments",
    path: "scripts/migrate-nonprod/gh-api-comments.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-gh-comment",
    path: "scripts/migrate-nonprod/gh-comment.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-hash",
    path: "scripts/migrate-nonprod/hash.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-markdown-fence",
    path: "scripts/migrate-nonprod/markdown-fence.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-plan-lib",
    path: "scripts/migrate-nonprod/plan-lib.mjs",
    infrastructure: true,
  },
  {
    id: "migrate-nonprod-plan",
    path: "scripts/migrate-nonprod/plan.ts",
    infrastructure: true,
  },
  {
    id: "migrate-nonprod-redact",
    path: "scripts/migrate-nonprod/redact.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-sanitize-for-comment",
    path: "scripts/migrate-nonprod/sanitize-for-comment.mjs",
    infrastructure: false,
  },
  {
    id: "migrate-nonprod-validate",
    path: "scripts/migrate-nonprod/validate.mjs",
    infrastructure: true,
  },
  {
    id: "check-attribution",
    path: "scripts/check-attribution.mjs",
    infrastructure: false,
  },
  {
    id: "check-consumer-email-bundle",
    path: "scripts/check-consumer-email-bundle.mjs",
    infrastructure: false,
  },
  {
    id: "check-email-templates-generated",
    path: "scripts/check-email-templates-generated.mjs",
    infrastructure: false,
  },
  {
    id: "check-placeholders",
    path: "scripts/check-placeholders.mjs",
    infrastructure: false,
  },
  {
    id: "check-theme-colors",
    path: "scripts/check-theme-colors.mjs",
    infrastructure: false,
  },
  {
    id: "check-warmup-no-emails",
    path: "scripts/check-warmup-no-emails.mjs",
    infrastructure: false,
  },
  {
    id: "check-workflow-d1-id-secrets",
    path: "scripts/check-workflow-d1-id-secrets.mjs",
    infrastructure: false,
  },
  {
    id: "check-workflow-provision-policy",
    path: "scripts/check-workflow-provision-policy.mjs",
    infrastructure: true,
  },
  {
    id: "ci-test-summary",
    path: "scripts/ci-test-summary.mjs",
    infrastructure: false,
  },
  {
    id: "clean-gallery-dist",
    path: "scripts/clean-gallery-dist.mjs",
    infrastructure: false,
  },
  {
    id: "dry-run-staging-config",
    path: "scripts/dry-run-staging-config.mjs",
    infrastructure: false,
  },
  {
    id: "gallery-preview-mode-script",
    path: "scripts/gallery-preview-mode.mjs",
    infrastructure: false,
  },
  {
    id: "gallery-preview-summary",
    path: "scripts/gallery-preview-summary.mjs",
    infrastructure: false,
  },
  {
    id: "generate-email-templates",
    path: "scripts/generate-email-templates.mjs",
    infrastructure: false,
  },
  {
    id: "gallery-assets-root",
    path: "scripts/lib/gallery-assets-root.mjs",
    infrastructure: false,
  },
  {
    id: "gallery-preview-mode-lib",
    path: "scripts/lib/gallery-preview-mode.mjs",
    infrastructure: false,
  },
  {
    id: "launchpad-attribution",
    path: "scripts/lib/launchpad-attribution.mjs",
    infrastructure: false,
  },
  {
    id: "theme-color-scan",
    path: "scripts/lib/theme-color-scan.mjs",
    infrastructure: false,
  },
  {
    id: "write-gallery-root-headers",
    path: "scripts/write-gallery-root-headers.mjs",
    infrastructure: false,
  },
  {
    id: "parse-wrangler-preview-json",
    path: "scripts/parse-wrangler-preview-json.mjs",
    infrastructure: false,
  },
  {
    id: "preview-comment-body",
    path: "scripts/preview-comment-body.mjs",
    infrastructure: false,
  },
  {
    id: "init-project",
    path: "scripts/init-project.mjs",
    infrastructure: false,
  },
  {
    id: "repo-settings-script",
    path: "scripts/repo-settings.mjs",
    infrastructure: true,
  },
  {
    id: "repo-settings-target",
    path: "scripts/lib/repo-settings-target.mjs",
    infrastructure: true,
  },
];
