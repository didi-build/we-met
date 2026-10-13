export const MIGRATE_NONPROD_MARKER = "<!-- we-met-migrate-nonprod -->";

export function hashMarker(hash) {
  return `<!-- we-met-migrate-hash:${hash} -->`;
}

/**
 * @param {{
 *   state: "waiting" | "applied" | "failed" | "skipped";
 *   headSha: string;
 *   migrationHash: string;
 *   files?: string[];
 *   runUrl?: string;
 *   appliedAt?: string;
 *   error?: string;
 * }} opts
 */
export function buildMigrateNonprodCommentBody(opts) {
  const lines = [
    MIGRATE_NONPROD_MARKER,
    hashMarker(opts.migrationHash),
    "",
    "## Non-prod D1 migrations",
    "",
    `**Head SHA:** \`${opts.headSha}\``,
    `**Migration hash:** \`${opts.migrationHash}\``,
    "",
  ];

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

/**
 * @param {string} body
 */
export function parseAppliedMigrationHash(body) {
  if (!body.includes(MIGRATE_NONPROD_MARKER)) {
    return null;
  }
  const hashMatch = body.match(/<!-- we-met-migrate-hash:([0-9a-f]{64}) -->/);
  if (!hashMatch) {
    return null;
  }
  const hash = hashMatch[1];
  if (!/\*\*Status:\*\* Applied/.test(body)) {
    return null;
  }
  return hash;
}
