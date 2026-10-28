import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";
import {
  collectGalleryConfigViolations,
  collectGalleryDeployViolations,
  collectGalleryPreviewArgvViolations,
  collectGalleryPreviewLocationViolations,
  collectGalleryWorkflowViolations,
  detectArrayFormGalleryDeploy,
  detectArrayFormGalleryPreview,
  extractWranglerDeploySegments,
  extractWranglerPreviewArgStrings,
  extractWranglerPreviewInvocations,
  extractYamlRunCommands,
  findWranglerPreviewSubcommand,
  flattenYamlRunBlocks,
  joinShellContinuations,
  normalizeForDeployScan,
  runGalleryGuards,
} from "../scripts/lib/check-gallery-guards-lib.mjs";

const BASE_CONFIG = {
  $schema: "node_modules/wrangler/config-schema.json",
  name: "we-met-preview",
  workers_dev: true,
  preview_urls: true,
  compatibility_date: "2026-09-24",
  assets: {
    directory: "./dist",
    not_found_handling: "single-page-application",
  },
  observability: { enabled: true },
  previews: {},
};

const VALID_PREVIEW_ARGS = `--config wrangler.gallery.jsonc --name "gallery-pr-1" --json`;

const MIN_GALLERY_WORKFLOW = `
jobs:
  preview:
    steps:
      - run: npx wrangler preview --config wrangler.gallery.jsonc --name gallery-pr-1 --json
`;

function writeGalleryFixtureRoot(
  root: string,
  overrides: {
    galleryWorkflow?: string;
    extraWorkflow?: string;
    scriptSh?: string;
    scriptMjs?: string;
    pkgScripts?: Record<string, string>;
  } = {},
) {
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "workers"), { recursive: true });
  writeFileSync(
    join(root, "wrangler.gallery.jsonc"),
    readFileSync("wrangler.gallery.jsonc", "utf8"),
  );
  writeFileSync(
    join(root, ".github/workflows/gallery-preview.yml"),
    overrides.galleryWorkflow ?? MIN_GALLERY_WORKFLOW,
  );
  if (overrides.extraWorkflow) {
    writeFileSync(join(root, ".github/workflows/extra.yml"), overrides.extraWorkflow);
  }
  if (overrides.scriptSh) {
    writeFileSync(join(root, "scripts/evil.sh"), overrides.scriptSh);
  }
  if (overrides.scriptMjs) {
    writeFileSync(join(root, "scripts/evil.mjs"), overrides.scriptMjs);
  }
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "gallery-guard-fixture",
        scripts: { noop: "true", ...overrides.pkgScripts },
      },
      null,
      2,
    ),
  );
}

const VALID_WORKFLOW_SNIPPET = `
run: |
  output="$(npx wrangler preview \\
    --config wrangler.gallery.jsonc \\
    --name "gallery-pr-\${PR_NUMBER}" \\
    --json 2>&1)"
`;

describe("gallery guards (unit)", () => {
  it("accepts the committed preview-only gallery config shape", () => {
    const committed = parseJsonc(readFileSync("wrangler.gallery.jsonc", "utf8"));
    expect(collectGalleryConfigViolations(committed)).toEqual([]);
    expect(collectGalleryConfigViolations(BASE_CONFIG)).toEqual([]);
  });

  it("rejects unknown top-level keys and assets.binding", () => {
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        main: ".open-next/worker.js",
      }),
    ).toContain("wrangler.gallery.jsonc must not define top-level key main.");
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        assets: {
          directory: "./dist",
          not_found_handling: "single-page-application",
          binding: "ASSETS",
        },
      }),
    ).toContain("wrangler.gallery.jsonc assets must not define binding.");
  });

  it("requires workers_dev true and assets.directory ./dist", () => {
    expect(
      collectGalleryConfigViolations({ ...BASE_CONFIG, workers_dev: false }),
    ).toContain("wrangler.gallery.jsonc must set workers_dev to true.");
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        assets: {
          directory: "./dist/gallery",
          not_found_handling: "single-page-application",
        },
      }),
    ).toContain('wrangler.gallery.jsonc assets.directory must be "./dist".');
  });

  it("parses wrangler preview across shell line continuations and committed 2>&1 redirect", () => {
    expect(collectGalleryWorkflowViolations(VALID_WORKFLOW_SNIPPET)).toEqual([]);
  });

  it("rejects global flags before preview subcommand including short = forms", () => {
    const suffix = "--config wrangler.gallery.jsonc --name x --json";
    const cases: { cmd: string; expectError: string }[] = [
      {
        cmd: `npx wrangler -c=wrangler.gallery.jsonc preview ${suffix} --env prod`,
        expectError: "must not pass -c.",
      },
      {
        cmd: `npx wrangler -e=prod preview --config wrangler.gallery.jsonc --name gallery-pr-1 --json`,
        expectError: "must not pass -e.",
      },
      {
        cmd: `npx wrangler --install-skills preview ${suffix} --env prod`,
        expectError:
          "must not pass wrangler global flag --install-skills before the preview subcommand.",
      },
      {
        cmd: `npx wrangler --env=prod preview --config wrangler.gallery.jsonc --name x --json`,
        expectError: "must not pass --env.",
      },
    ];
    for (const { cmd, expectError } of cases) {
      const errors = collectGalleryWorkflowViolations(cmd);
      expect(errors.some((entry) => entry.includes(expectError))).toBe(true);
    }
  });

  it("rejects flags smuggled after 2>&1 on gallery preview", () => {
    const suffix = "--config wrangler.gallery.jsonc --name gallery-pr-1 --json";
    expect(
      collectGalleryWorkflowViolations(
        `npx wrangler preview ${suffix} 2>&1 --env production`,
      ),
    ).toContain("gallery-preview.yml wrangler preview must not pass --env.");
    expect(
      collectGalleryWorkflowViolations(`npx wrangler preview ${suffix} 2>&1 --var=A:1`),
    ).toContain("gallery-preview.yml wrangler preview must not pass --var.");
    expect(
      collectGalleryPreviewLocationViolations(
        `npx wrangler preview 2>&1 --config wrangler.gallery.jsonc --name x --json`,
        "scripts/evil.sh",
      ),
    ).toContain(
      "scripts/evil.sh must not run wrangler preview with wrangler.gallery.jsonc (only .github/workflows/gallery-preview.yml).",
    );
  });

  it("detects deploy when global flags use short = forms or unknown booleans", () => {
    expect(
      collectGalleryDeployViolations(
        'execSync("npx wrangler -c=wrangler.gallery.jsonc deploy")',
        "scripts/x.mjs",
      ),
    ).toContain(
      "scripts/x.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
    expect(
      collectGalleryDeployViolations(
        'execSync("npx wrangler --install-skills deploy -c wrangler.gallery.jsonc")',
        "scripts/x.mjs",
      ),
    ).toContain(
      "scripts/x.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("rejects shell quote tricks, env prefixes, and unquoted --name with shell expansion", () => {
    const suffix = "--name gallery-pr-1 --json";
    expect(
      collectGalleryWorkflowViolations(
        `npx wrangler pre''view --config wrangler.gallery.jsonc ${suffix}`,
      ),
    ).toEqual([]);
    expect(
      collectGalleryWorkflowViolations(
        `npx wrangler "pre"view --config wrangler.gallery.jsonc ${suffix}`,
      ),
    ).toEqual([]);
    expect(
      collectGalleryWorkflowViolations(
        `CLOUDFLARE_ENV=production npx wrangler preview --config wrangler.gallery.jsonc ${suffix}`,
      ),
    ).toContain(
      "gallery-preview.yml wrangler preview must not use shell env assignments on the command line.",
    );
    expect(
      collectGalleryPreviewArgvViolations(
        `--config wrangler.gallery.json'c' --name x --json`,
      ),
    ).toEqual([]);
    expect(
      collectGalleryWorkflowViolations(
        `npx wrangler preview --config wrangler.gallery.jsonc --name $PR --json`,
      ),
    ).toContain(
      "gallery-preview.yml wrangler preview --name must be a literal or double-quoted string.",
    );
  });

  it("detects spawn( array-form gallery deploy and preview", () => {
    const deploySpawn = `spawn("npx", ["wrangler", "deploy", "--config", "wrangler.gallery.jsonc"]);`;
    expect(detectArrayFormGalleryDeploy(deploySpawn)).toBe(true);
    const previewSpawn = `spawnSync("npx", ["wrangler", "preview", "--config", "wrangler.gallery.jsonc"]);`;
    expect(detectArrayFormGalleryPreview(previewSpawn)).toBe(true);
    expect(
      collectGalleryPreviewLocationViolations(previewSpawn, "scripts/evil.mjs"),
    ).toContain(
      "scripts/evil.mjs must not run wrangler preview with wrangler.gallery.jsonc (only .github/workflows/gallery-preview.yml).",
    );
  });

  it("does not treat preview as a separate -c value token", () => {
    expect(
      findWranglerPreviewSubcommand(["-c", "preview", "--config", "x"], 0).index,
    ).toBe(-1);
    const suffix = "--config wrangler.gallery.jsonc --name x --json";
    expect(
      collectGalleryWorkflowViolations(`npx wrangler -c preview ${suffix}`).some(
        (entry) => entry.includes("must invoke wrangler preview"),
      ),
    ).toBe(true);
  });

  it("uses shared preview subcommand scan for --env= before preview", () => {
    const tokens = ["--env=prod", "preview", "--config", "wrangler.gallery.jsonc"];
    expect(findWranglerPreviewSubcommand(tokens, 0).index).toBe(1);
    const cmd =
      "npx wrangler --env=prod preview --config wrangler.gallery.jsonc --name x --json";
    const inv = extractWranglerPreviewInvocations(normalizeForDeployScan(cmd));
    expect(inv).toHaveLength(1);
    expect(collectGalleryPreviewArgvViolations(inv[0]!.argString)).toContain(
      "gallery-preview.yml wrangler preview must not pass --env.",
    );
  });

  it("rejects wrangler preview with --worker-name", () => {
    const bad = `
      npx wrangler preview --config wrangler.gallery.jsonc --worker-name we-met --name x --json
    `;
    expect(collectGalleryWorkflowViolations(bad)).toContain(
      "gallery-preview.yml wrangler preview must not pass --worker-name.",
    );
  });

  it("rejects boolean preview flags with =value", () => {
    expect(
      collectGalleryPreviewArgvViolations(
        `--config wrangler.gallery.jsonc --json=false --name x --json`,
      ),
    ).toContain(
      "gallery-preview.yml wrangler preview must not pass --json with a value.",
    );
    expect(
      collectGalleryPreviewArgvViolations(
        `--config wrangler.gallery.jsonc --name x --json=false`,
      ),
    ).toContain(
      "gallery-preview.yml wrangler preview must not pass --json with a value.",
    );
  });

  it("rejects repeated preview flags even when the last value is allowed", () => {
    expect(
      collectGalleryPreviewArgvViolations(
        `--config wrangler.jsonc --config wrangler.gallery.jsonc --name x --json`,
      ),
    ).toContain("gallery-preview.yml wrangler preview must not repeat --config.");
    expect(
      collectGalleryPreviewArgvViolations(
        `--config wrangler.gallery.jsonc --name evil --name x --json`,
      ),
    ).toContain("gallery-preview.yml wrangler preview must not repeat --name.");
  });

  it("rejects wrong --config value on gallery preview", () => {
    expect(
      collectGalleryPreviewArgvViolations(`--config wrangler.jsonc --name x --json`),
    ).toContain(
      "gallery-preview.yml wrangler preview must pass --config wrangler.gallery.jsonc.",
    );
  });

  it("finds wrangler preview with alternate spellings and applies argv or location guards", () => {
    const suffix = "--name x --json";
    const cases: {
      cmd: string;
      argvFlag?: string;
      locationLabel?: string;
    }[] = [
      {
        cmd: `npx wrangler -e production preview --config wrangler.gallery.jsonc ${suffix}`,
        argvFlag: "-e",
      },
      {
        cmd: `npx wrangler --env-file .env preview --config wrangler.gallery.jsonc ${suffix}`,
        argvFlag: "--env-file",
      },
      {
        cmd: `npx wrangler -c wrangler.gallery.jsonc preview ${suffix}`,
        argvFlag: "-c",
        locationLabel: "scripts/evil.sh",
      },
      {
        cmd: `npx wrangler "preview" --config wrangler.gallery.jsonc ${suffix}`,
      },
      {
        cmd: `npx 'wrangler' preview --config wrangler.gallery.jsonc ${suffix}`,
      },
      {
        cmd: `npm exec wrangler -- preview --config wrangler.gallery.jsonc ${suffix}`,
      },
    ];
    for (const { cmd, argvFlag, locationLabel } of cases) {
      const normalized = normalizeForDeployScan(cmd);
      const argStrings = extractWranglerPreviewArgStrings(normalized);
      expect(argStrings.length).toBeGreaterThan(0);
      const argvErrors = collectGalleryPreviewArgvViolations(argStrings[0]!);
      if (argvFlag) {
        expect(argvErrors).toContain(
          `gallery-preview.yml wrangler preview must not pass ${argvFlag}.`,
        );
      } else {
        expect(argvErrors).toEqual([]);
      }
      if (locationLabel) {
        expect(collectGalleryPreviewLocationViolations(cmd, locationLabel)).toContain(
          `${locationLabel} must not run wrangler preview with wrangler.gallery.jsonc (only .github/workflows/gallery-preview.yml).`,
        );
      }
    }
  });

  it("rejects wrangler preview with disallowed flags including = spellings and -e", () => {
    const cases: { args: string; flag: string }[] = [
      {
        args: `${VALID_PREVIEW_ARGS} --secrets-file=.dev.vars`,
        flag: "--secrets-file",
      },
      { args: `${VALID_PREVIEW_ARGS} --var=FOO:bar`, flag: "--var" },
      { args: `${VALID_PREVIEW_ARGS} -e staging`, flag: "-e" },
      { args: `${VALID_PREVIEW_ARGS} --env production`, flag: "--env" },
      {
        args: `--config=wrangler.gallery.jsonc --name x --json --dry-run`,
        flag: "--dry-run",
      },
    ];
    for (const { args, flag } of cases) {
      expect(collectGalleryPreviewArgvViolations(args)).toContain(
        `gallery-preview.yml wrangler preview must not pass ${flag}.`,
      );
    }
    expect(
      collectGalleryPreviewArgvViolations(
        `--config=wrangler.gallery.jsonc --name x --json`,
      ),
    ).toEqual([]);
    expect(
      collectGalleryPreviewArgvViolations(
        `--config=wrangler.gallery.jsonc --worker-name=evil --ignore-base-config --name x --json`,
      ),
    ).toContain("gallery-preview.yml wrangler preview must not pass --worker-name.");
  });

  it("rejects wrangler preview with --var and -c", () => {
    expect(
      collectGalleryPreviewArgvViolations(`${VALID_PREVIEW_ARGS} --var FOO:bar`),
    ).toContain("gallery-preview.yml wrangler preview must not pass --var.");
    expect(
      collectGalleryPreviewArgvViolations(`-c wrangler.gallery.jsonc --name x --json`),
    ).toContain("gallery-preview.yml wrangler preview must not pass -c.");
  });

  it("rejects wrangler preview with a positional script", () => {
    expect(
      collectGalleryPreviewArgvViolations(`worker.js ${VALID_PREVIEW_ARGS}`),
    ).toContain(
      "gallery-preview.yml wrangler preview must not pass a positional Worker script.",
    );
  });

  it("detects array-form wrangler deploy with gallery config", () => {
    const script = `
      import { spawnSync } from "node:child_process";
      spawnSync("npx", ["wrangler", "deploy", "--config", "wrangler.gallery.jsonc"]);
    `;
    expect(detectArrayFormGalleryDeploy(script)).toBe(true);
    expect(
      collectGalleryDeployViolations(script, "scripts/publish-gallery.mjs"),
    ).toContain(
      "scripts/publish-gallery.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
    const wranglerCmd = `spawnSync("wrangler", ["deploy", "--config", "wrangler.gallery.jsonc"]);`;
    expect(detectArrayFormGalleryDeploy(wranglerCmd)).toBe(true);
  });

  it("rejects gallery wrangler preview outside gallery-preview.yml", () => {
    const snippet = `npx wrangler preview --config wrangler.gallery.jsonc --name x --json`;
    expect(
      collectGalleryPreviewLocationViolations(
        snippet,
        ".github/workflows/evil-preview.yml",
        { isYaml: true },
      ),
    ).toContain(
      ".github/workflows/evil-preview.yml must not run wrangler preview with wrangler.gallery.jsonc (only .github/workflows/gallery-preview.yml).",
    );
    expect(
      collectGalleryPreviewLocationViolations(
        snippet,
        ".github/workflows/gallery-preview.yml",
        { isGalleryWorkflow: true, isYaml: true },
      ),
    ).toEqual([]);
  });

  it("rejects wrangler deploy in gallery-preview.yml", () => {
    expect(
      collectGalleryDeployViolations(
        "npx wrangler deploy --config wrangler.jsonc",
        ".github/workflows/gallery-preview.yml",
        { isGalleryWorkflow: true, isYaml: true },
      ),
    ).toContain(
      ".github/workflows/gallery-preview.yml must not run wrangler deploy or wrangler versions deploy.",
    );
  });

  it("detects wrangler deploy after a backslash continuation", () => {
    const script = "npx wrangler \\\n  deploy --config wrangler.gallery.jsonc";
    expect(joinShellContinuations(script)).toMatch(/\bwrangler\s+deploy\b/);
    expect(collectGalleryDeployViolations(script, "scripts/evil.mjs")).toContain(
      "scripts/evil.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("detects flags before deploy subcommand", () => {
    const cmd = "wrangler --config wrangler.gallery.jsonc deploy";
    const normalized = normalizeForDeployScan(cmd);
    expect(extractWranglerDeploySegments(normalized)).toHaveLength(1);
    expect(collectGalleryDeployViolations(cmd, "scripts/evil.mjs")).toContain(
      "scripts/evil.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("detects wrangler versions deploy with gallery config", () => {
    expect(
      collectGalleryDeployViolations(
        "wrangler versions deploy --config wrangler.gallery.jsonc",
        "scripts/evil.mjs",
      ),
    ).toContain(
      "scripts/evil.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("detects gallery deploy inside realistic multiline execSync source (round 4)", () => {
    const script = `import { execSync } from "node:child_process";

export function publishGallery() {
  execSync(
    "npx wrangler -c=wrangler.gallery.jsonc deploy",
  );
}
`;
    expect(
      collectGalleryDeployViolations(script, "scripts/publish-gallery.mjs"),
    ).toContain(
      "scripts/publish-gallery.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("keeps full yaml run blocks with printf/set/if and still catches deploy (round 4)", () => {
    const yaml = `
jobs:
  evil:
    steps:
      - run: |-
          set -euo pipefail
          preview_status=0
          if [ "\${preview_status}" -ne 0 ]; then
            printf '%s\\n' "skip"
          fi
          ./node_modules/.bin/wrangler deploy --config wrangler.gallery.jsonc
`;
    const flat = flattenYamlRunBlocks(yaml);
    expect(extractYamlRunCommands(flat).join("\n")).toContain("preview_status=");
    expect(extractYamlRunCommands(flat).join("\n")).toContain("printf");
    expect(
      collectGalleryDeployViolations(flat, ".github/workflows/evil.yml", {
        isYaml: true,
      }),
    ).toContain(
      ".github/workflows/evil.yml must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("detects path-prefixed wrangler binary in sh, workflow, and package.json (round 4)", () => {
    const cmd = "./node_modules/.bin/wrangler deploy --config wrangler.gallery.jsonc";
    expect(collectGalleryDeployViolations(cmd, "scripts/evil.sh")).toContain(
      "scripts/evil.sh must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
    expect(
      collectGalleryDeployViolations(cmd, ".github/workflows/evil.yml", {
        isYaml: true,
      }),
    ).toContain(
      ".github/workflows/evil.yml must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
    expect(
      collectGalleryDeployViolations(cmd, "package.json scripts.gallery:evil"),
    ).toContain(
      "package.json scripts.gallery:evil must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("flattens yaml run blocks for deploy scan", () => {
    const yaml = `
steps:
  - run: |
      npx wrangler \\
        --config wrangler.gallery.jsonc \\
        deploy
`;
    const flat = flattenYamlRunBlocks(yaml);
    expect(
      collectGalleryDeployViolations(flat, "evil.yml", { isYaml: true }),
    ).toContain(
      "evil.yml must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("scans .ts files for gallery config deploy", () => {
    expect(
      collectGalleryDeployViolations(
        "await exec('wrangler deploy --config wrangler.gallery.jsonc')",
        "scripts/publish-gallery.ts",
      ),
    ).toContain(
      "scripts/publish-gallery.ts must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("fails package.json gallery:deploy script fixture", () => {
    expect(
      collectGalleryDeployViolations(
        "wrangler deploy --config wrangler.gallery.jsonc",
        "package.json scripts.gallery:deploy",
      ),
    ).toContain(
      "package.json scripts.gallery:deploy must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("accepts the committed gallery-preview workflow and runGalleryGuards", () => {
    const workflow = readFileSync(".github/workflows/gallery-preview.yml", "utf8");
    expect(collectGalleryWorkflowViolations(workflow)).toEqual([]);
    expect(
      collectGalleryDeployViolations(
        workflow,
        ".github/workflows/gallery-preview.yml",
        {
          isGalleryWorkflow: true,
          isYaml: true,
        },
      ),
    ).toEqual([]);
    expect(runGalleryGuards()).toEqual([]);
  });
});

describe("runGalleryGuards fixture repo", () => {
  it("passes on a minimal valid gallery guard fixture", () => {
    const root = mkdtempSync(join(tmpdir(), "gallery-guards-fixture-"));
    try {
      writeGalleryFixtureRoot(root);
      expect(runGalleryGuards(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when gallery-preview uses the wrong --config", () => {
    const root = mkdtempSync(join(tmpdir(), "gallery-guards-fixture-"));
    try {
      writeGalleryFixtureRoot(root, {
        galleryWorkflow: MIN_GALLERY_WORKFLOW.replace(
          "wrangler.gallery.jsonc",
          "wrangler.jsonc",
        ),
      });
      expect(runGalleryGuards(root)).toContain(
        "gallery-preview.yml wrangler preview must pass --config wrangler.gallery.jsonc.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when gallery-preview.yml contains array-form gallery deploy", () => {
    const root = mkdtempSync(join(tmpdir(), "gallery-guards-fixture-"));
    try {
      writeGalleryFixtureRoot(root, {
        galleryWorkflow: `
jobs:
  preview:
    steps:
      - run: node -e "require('child_process').spawnSync('wrangler', ['deploy', '--config', 'wrangler.gallery.jsonc'])"
      - run: npx wrangler preview --config wrangler.gallery.jsonc --name x --json
`,
      });
      expect(runGalleryGuards(root)).toContain(
        ".github/workflows/gallery-preview.yml must not run wrangler deploy or wrangler versions deploy.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when another workflow runs gallery wrangler preview", () => {
    const root = mkdtempSync(join(tmpdir(), "gallery-guards-fixture-"));
    try {
      writeGalleryFixtureRoot(root, {
        extraWorkflow: `
jobs:
  evil:
    steps:
      - run: npx wrangler preview --config wrangler.gallery.jsonc --name x --json
`,
      });
      expect(runGalleryGuards(root)).toContain(
        ".github/workflows/extra.yml must not run wrangler preview with wrangler.gallery.jsonc (only .github/workflows/gallery-preview.yml).",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a scripts/*.sh file runs gallery wrangler preview", () => {
    const root = mkdtempSync(join(tmpdir(), "gallery-guards-fixture-"));
    try {
      writeGalleryFixtureRoot(root, {
        scriptSh:
          "npx wrangler preview --config wrangler.gallery.jsonc --name x --json\n",
      });
      expect(runGalleryGuards(root)).toContain(
        "scripts/evil.sh must not run wrangler preview with wrangler.gallery.jsonc (only .github/workflows/gallery-preview.yml).",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a package.json script runs gallery wrangler preview", () => {
    const root = mkdtempSync(join(tmpdir(), "gallery-guards-fixture-"));
    try {
      writeGalleryFixtureRoot(root, {
        pkgScripts: {
          "gallery:preview:evil":
            "npx wrangler preview --config wrangler.gallery.jsonc --name x --json",
        },
      });
      expect(runGalleryGuards(root)).toContain(
        "package.json scripts.gallery:preview:evil must not run wrangler preview with wrangler.gallery.jsonc (only .github/workflows/gallery-preview.yml).",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when scripts/evil.mjs uses spawn gallery deploy", () => {
    const root = mkdtempSync(join(tmpdir(), "gallery-guards-fixture-"));
    try {
      writeGalleryFixtureRoot(root, {
        scriptMjs: `import { spawn } from "node:child_process";
spawn("npx", ["wrangler", "deploy", "--config", "wrangler.gallery.jsonc"]);`,
      });
      expect(runGalleryGuards(root)).toContain(
        "scripts/evil.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a package.json script runs gallery wrangler deploy", () => {
    const root = mkdtempSync(join(tmpdir(), "gallery-guards-fixture-"));
    try {
      writeGalleryFixtureRoot(root, {
        pkgScripts: {
          "gallery:deploy:evil": "wrangler deploy --config wrangler.gallery.jsonc",
        },
      });
      expect(runGalleryGuards(root)).toContain(
        "package.json scripts.gallery:deploy:evil must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
