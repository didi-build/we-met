import { formatMarkdownCodeFence } from "../migrate-nonprod/markdown-fence.mjs";
import { sanitizeForComment } from "../migrate-nonprod/sanitize-for-comment.mjs";

const ADVISORY_LINT_NOTE =
  "Expand-only lint (written for the shared non-prod database) was run for visibility only; violations do not block this deploy.";

const HONEST_LIMIT_NOTE =
  "This plan reports git changes since the last successful production deployment, not the database's real applied state. A previously failed deploy that partly applied migrations, or SQL run by hand, would not appear here. The migrate step still relies on Wrangler's own migration tracking.";

/**
 * @param {string} text
 * @returns {string}
 */
export function sanitizeExternalPlanText(text) {
  let out = sanitizeForComment(text);
  out = out.replace(/::/g, "⸨⸩");
  return out;
}

/**
 * @param {{ path: string; changeKind: string; previousPath?: string; introduction?: string; sql: string; lintWarnings?: string[] }} entry
 * @returns {string}
 */
export function formatMigrationSection(entry) {
  const safePath = sanitizeExternalPlanText(entry.path);
  const changeLabel =
    entry.changeKind === "added"
      ? "**Added**"
      : entry.changeKind === "changed"
        ? "**Changed** (not a new file)"
        : "**Listed**";
  const intro = entry.introduction
    ? sanitizeExternalPlanText(entry.introduction)
    : "Last changed in: unknown";
  const lines = [`### \`${safePath}\``, "", `- ${changeLabel}`, `- ${intro}`];
  if (entry.previousPath) {
    lines.push(`- Previous path: \`${sanitizeExternalPlanText(entry.previousPath)}\``);
  }
  if (entry.lintWarnings && entry.lintWarnings.length > 0) {
    lines.push(
      "",
      "**Advisory lint warnings:**",
      ...entry.lintWarnings.map((w) => `- ${sanitizeExternalPlanText(w)}`),
    );
  }
  lines.push("", formatMarkdownCodeFence(entry.sql.trimEnd(), "sql"));
  return lines.join("\n");
}

/**
 * @param {{
 *   headSha: string;
 *   baselineSha: string | null;
 *   plan: import("./compare-migrations.mjs").CompareMigrationPlan | import("./compare-migrations.mjs").ListAllMigrationPlan;
 *   migrationSections: string[];
 *   globalLintWarnings?: string[];
 * }} input
 * @returns {string}
 */
export function buildPlanSummaryMarkdown(input) {
  const { headSha, baselineSha, plan, migrationSections, globalLintWarnings } = input;
  const safeHead = sanitizeExternalPlanText(headSha);
  const lines = ["## Production D1 migration plan", ""];

  if (baselineSha) {
    lines.push(
      `**Baseline (last successful production deploy):** \`${sanitizeExternalPlanText(baselineSha)}\``,
    );
  } else {
    lines.push("**Baseline:** none (no previous successful production deployment)");
  }
  lines.push(`**Deploy commit:** \`${safeHead}\``, "");

  if (plan.mode === "list_all" && plan.fallbackReason) {
    lines.push(`> ${sanitizeExternalPlanText(plan.fallbackReason)}`, "");
  } else if (plan.mode === "compare" && plan.fallbackReason) {
    lines.push(`> ${sanitizeExternalPlanText(plan.fallbackReason)}`, "");
  }

  const count = plan.migrations.length;
  if (count === 0) {
    lines.push("**No migrations in this deploy.**", "");
  } else {
    lines.push(`**Migrations in this deploy (${count}):**`, "");
    for (const section of migrationSections) {
      lines.push(section, "");
    }
  }

  lines.push("---", "", `_${HONEST_LIMIT_NOTE}_`, "", `_${ADVISORY_LINT_NOTE}_`);

  if (globalLintWarnings && globalLintWarnings.length > 0) {
    lines.push("", "**Additional advisory lint notes:**");
    for (const w of globalLintWarnings) {
      lines.push(`- ${sanitizeExternalPlanText(w)}`);
    }
  }

  return lines.join("\n");
}

/**
 * @param {{ migrationPaths: string[] }} input
 * @returns {string | null} workflow annotation line, or null when zero migrations
 */
export function buildWarningAnnotation(input) {
  const { migrationPaths } = input;
  if (migrationPaths.length === 0) {
    return null;
  }
  const safeNames = migrationPaths.join(", ");
  const n = migrationPaths.length;
  const noun = n === 1 ? "migration" : "migrations";
  return `This deploy includes ${n} ${noun}: ${safeNames}`;
}

/**
 * @param {{ category: import("./failure-classification.mjs").PlanFailureCategory; detail: string }} input
 * @returns {{ summaryMarkdown: string; warningAnnotation: string }}
 */
export function buildPlanFailureContent(input) {
  const detail = sanitizeExternalPlanText(input.detail);
  let headline;
  let body;
  if (input.category === "github_unavailable") {
    headline = `PLAN UNAVAILABLE: GitHub API problem (${detail}).`;
    body =
      "This is not caused by our code. The plan will return on the next run. This does NOT mean there are no migrations: if you know this commit adds one, check migrations/ by hand.";
  } else if (input.category === "access_or_config") {
    headline = `PLAN FAILED: access or config problem (${detail}).`;
    body = "Needs a fix. Check migrations/ by hand before approving.";
  } else {
    headline = `PLAN FAILED: bug in the plan job (${detail}).`;
    body = "Needs a fix. Check migrations/ by hand before approving.";
  }
  const summaryMarkdown = [
    "## Production D1 migration plan",
    "",
    `**${headline}**`,
    "",
    body,
    "",
    "_The deploy job is not blocked; production approval remains the gate._",
  ].join("\n");
  return { summaryMarkdown, warningAnnotation: headline };
}

/**
 * @param {string} failedStepId
 * @returns {{ summaryMarkdown: string; warningAnnotation: string }}
 */
export function buildPlanSetupFailureContent(failedStepId) {
  const step = sanitizeExternalPlanText(failedStepId);
  const headline = `PLAN FAILED: setup step ${step} failed before the plan could run.`;
  const body =
    "If the step log shows a GitHub or npm outage, it is probably fine to approve; otherwise it needs a fix. Check migrations/ by hand before approving.";
  const summaryMarkdown = [
    "## Production D1 migration plan",
    "",
    `**${headline}**`,
    "",
    body,
    "",
    "_The deploy job is not blocked; production approval remains the gate._",
  ].join("\n");
  return { summaryMarkdown, warningAnnotation: headline };
}

/**
 * @returns {{ summaryMarkdown: string; warningAnnotation: string }}
 */
export function buildPlanStepCrashFailureContent() {
  const headline = "PLAN FAILED: plan step crashed or timed out before finishing.";
  const body =
    "The plan step exited with an error or timed out (for example import or tsx failure). Check the plan step log. This needs a fix. Check migrations/ by hand before approving.";
  const summaryMarkdown = [
    "## Production D1 migration plan",
    "",
    `**${headline}**`,
    "",
    body,
    "",
    "_The deploy job is not blocked; production approval remains the gate._",
  ].join("\n");
  return { summaryMarkdown, warningAnnotation: headline };
}

export { ADVISORY_LINT_NOTE, HONEST_LIMIT_NOTE };
