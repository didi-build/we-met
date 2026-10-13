export const MIGRATE_NONPROD_MARKER = "<!-- we-met-migrate-nonprod -->";

export function hashMarker(hash) {
  return `<!-- we-met-migrate-hash:${hash} -->`;
}

const APPLIED_MARKER_RE = /<!-- we-met-migrate-applied:(\{[\s\S]*?\}) -->/;

/**
 * @param {{ hash: string; files: Record<string, string> }} state
 */
export function buildAppliedStateMarker(state) {
  return `<!-- we-met-migrate-applied:${JSON.stringify(state)} -->`;
}

/**
 * @param {string} body
 * @returns {{ hash: string; files: Record<string, string> } | null}
 */
export function parseAppliedStateMarker(body) {
  const match = body.match(APPLIED_MARKER_RE);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    if (
      typeof parsed.hash === "string" &&
      parsed.files &&
      typeof parsed.files === "object"
    ) {
      return { hash: parsed.hash, files: parsed.files };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {string} body
 */
export function parseAppliedMigrationHash(body) {
  return parseAppliedStateMarker(body)?.hash ?? null;
}

/**
 * @param {string} body
 */
export function extractPreservedAppliedMarker(body) {
  const match = body.match(APPLIED_MARKER_RE);
  return match ? match[0] : null;
}

/**
 * @param {{
 *   state: "waiting" | "applied" | "failed" | "skipped";
 *   headSha: string;
 *   migrationHash: string;
 *   files?: string[];
 *   fileHashes?: Record<string, string>;
 *   runUrl?: string;
 *   appliedAt?: string;
 *   error?: string;
 *   preservedAppliedMarker?: string | null;
 * }} opts
 */
export function buildMigrateNonprodCommentBody(opts) {
  const lines = [MIGRATE_NONPROD_MARKER, hashMarker(opts.migrationHash)];

  let appliedMarker = opts.preservedAppliedMarker ?? null;
  if (opts.state === "applied" && opts.fileHashes) {
    appliedMarker = buildAppliedStateMarker({
      hash: opts.migrationHash,
      files: opts.fileHashes,
    });
  }
  if (appliedMarker) {
    lines.push(appliedMarker);
  }

  lines.push(
    "",
    "## Non-prod D1 migrations",
    "",
    `**Head SHA:** \`${opts.headSha}\``,
    `**Migration hash:** \`${opts.migrationHash}\``,
    "",
  );

  if (opts.state === "waiting") {
    lines.push(
      "**Status:** Waiting for approval — review the plan job summary, then approve the **apply** job for environment `migrate-nonprod`.",
    );
    if (opts.runUrl) {
      lines.push("");
      lines.push(`[Open workflow run](${opts.runUrl})`);
    }
    if (opts.files?.length) {
      lines.push("");
      lines.push("**Files to apply:**");
      for (const file of opts.files) {
        lines.push(`- \`${file}\``);
      }
    }
  } else if (opts.state === "applied") {
    lines.push(`**Status:** Applied${opts.appliedAt ? ` at ${opts.appliedAt}` : ""}.`);
    if (opts.files?.length) {
      lines.push("");
      lines.push("**Applied files:**");
      for (const file of opts.files) {
        lines.push(`- \`${file}\``);
      }
    }
  } else if (opts.state === "skipped") {
    lines.push(
      "**Status:** No new approval needed (migration hash unchanged since last apply).",
    );
  } else if (opts.state === "failed") {
    lines.push("**Status:** Failed.");
    if (opts.error) {
      lines.push("");
      lines.push("```");
      lines.push(opts.error.trim());
      lines.push("```");
    }
    if (opts.runUrl) {
      lines.push("");
      lines.push(`[Open workflow run](${opts.runUrl})`);
    }
  }

  return `${lines.join("\n")}\n`;
}
