import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { spawnSync } from "node:child_process";
import { spawnSync as nodeSpawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runActivation,
  runActivationFromCliOrEvent,
} from "../scripts/activate-staging-account.mjs";
import {
  ACTIVATION_EVENT_EMAIL_CONTROL_REJECTED,
  ACTIVATION_D1_BINDING,
  ACTIVATION_D1_DATABASE_NAME,
  assertWranglerConfigD1Binding,
  assertWranglerConfigTargetsNonprodD1,
  buildActivationUpdateCommand,
  buildWranglerD1ExecuteArgv,
  emailAppearsOnlyInWhereLiteral,
  parseWranglerD1ExecuteRowChanges,
  readWorkflowDispatchEmailFromGithubEvent,
  resolveActivationRowOutcome,
  validateActivationEmail,
  WRANGLER_D1_EXECUTE_SPAWN_OPTIONS,
} from "../scripts/lib/activate-staging-account.mjs";
import { D1_PLACEHOLDER_PRODUCTION } from "../scripts/lib/wrangler-placeholders.mjs";
import { workflowPermissionsAllowOnly } from "../scripts/lib/workflow-permissions-parse.mjs";

const EXPECTED_D1_ID = "11111111-2222-3333-4444-555555555555";

const ACTIVATION_WORKFLOW_RUN_BLOCK =
  /^\s+(?:-\s+)?run:\s*\|[\s\S]*?(?=\n\s{6}\S|\n\s{4}\S|(?![\s\S]))/gm;
const ACTIVATION_WORKFLOW_RUN_LINE = /^\s+(?:-\s+)?run:\s+[^\n|]+$/gm;

const wranglerConfigTempDirs: string[] = [];

afterEach(() => {
  for (const dir of wranglerConfigTempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function activationWorkflowRunScripts(workflow: string): string[] {
  const runBlocks = workflow.match(ACTIVATION_WORKFLOW_RUN_BLOCK) ?? [];
  const runLines = workflow.match(ACTIVATION_WORKFLOW_RUN_LINE) ?? [];
  return [...runBlocks, ...runLines];
}

function testEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    WE_MET_D1_DATABASE_ID_NONPROD: EXPECTED_D1_ID,
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

function mockSpawn(
  impl: () => { status: number; stdout: string; stderr: string },
): typeof spawnSync {
  return vi.fn(impl) as unknown as typeof spawnSync;
}

function captureIo() {
  const stdout: unknown[] = [];
  const stderr: unknown[] = [];
  const consoleCalls: { method: string; args: unknown[] }[] = [];
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout.push(chunk);
    return true;
  });
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr.push(chunk);
    return true;
  });
  for (const method of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      consoleCalls.push({ method, args });
    });
  }
  return {
    stdout,
    stderr,
    consoleCalls,
    allText() {
      return [
        ...stdout.map(String),
        ...stderr.map(String),
        ...consoleCalls.flatMap((entry) => entry.args.map(String)),
      ].join("\n");
    },
    restore() {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      vi.restoreAllMocks();
    },
  };
}

function expectIoExcludesWranglerAndRawEmail(
  io: ReturnType<typeof captureIo>,
  rawEmail: string,
  wranglerPayload: string,
) {
  const text = io.allText();
  expect(text).not.toContain(wranglerPayload);
  expect(text.toLowerCase()).not.toContain(rawEmail.toLowerCase());
  if (rawEmail !== rawEmail.toLowerCase()) {
    expect(text).not.toContain(rawEmail);
  }
}

function writeWranglerConfig(config: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), "activate-staging-guard-"));
  wranglerConfigTempDirs.push(dir);
  const path = join(dir, "config.jsonc");
  writeFileSync(path, JSON.stringify(config, null, 2));
  return path;
}

function validWranglerConfig(overrides: Record<string, unknown> = {}) {
  return writeWranglerConfig({
    d1_databases: [
      {
        binding: ACTIVATION_D1_BINDING,
        database_name: ACTIVATION_D1_DATABASE_NAME,
        database_id: EXPECTED_D1_ID,
      },
    ],
    ...overrides,
  });
}

function wranglerSuccessStdout(changes: number, success = true) {
  return JSON.stringify([{ success, meta: { changes } }]);
}

describe("validateActivationEmail (unit)", () => {
  it("accepts typical maintainer emails", () => {
    expect(validateActivationEmail("diadem@didi.build")).toEqual({
      ok: true,
      normalized: "diadem@didi.build",
    });
  });

  it("rejects forbidden character classes on their own", () => {
    const result = validateActivationEmail("foo bar@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email contains forbidden characters");
    }
  });

  it("rejects non-string input on its own", () => {
    const result = validateActivationEmail(42);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email must be a string");
    }
  });

  it("rejects SQL comment marker sequences on their own", () => {
    const result = validateActivationEmail("comment--marker@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email contains forbidden sequences");
    }
  });

  it("rejects single quotes on their own", () => {
    const result = validateActivationEmail("user'quote@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email contains forbidden characters");
    }
  });

  it("rejects whole-address length without tripping the local-part limit first", () => {
    const result = validateActivationEmail(
      `${"a".repeat(64)}@${"b".repeat(178)}.example.com`,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email is too long");
    }
  });

  it("rejects domain length without tripping whole-address length first", () => {
    const result = validateActivationEmail(`a@${"b".repeat(242)}.example.com`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email domain length is invalid");
    }
  });

  it("rejects local-part dot edges on their own", () => {
    const leading = validateActivationEmail(".user@example.com");
    expect(leading.ok).toBe(false);
    if (!leading.ok) {
      expect(leading.reason).toBe("email local part has invalid dots");
    }
    const trailing = validateActivationEmail("user.@example.com");
    expect(trailing.ok).toBe(false);
    if (!trailing.ok) {
      expect(trailing.reason).toBe("email local part has invalid dots");
    }
  });

  it("rejects a leading dot in the domain on its own", () => {
    const result = validateActivationEmail("user@.example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email domain has invalid dots");
    }
  });

  it("rejects punycode domains on example.org on their own", () => {
    const result = validateActivationEmail("user@xn--abc.example.org");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email domain punycode (xn--) is not allowed");
    }
  });

  it("rejects odd local parts", () => {
    expect(validateActivationEmail("a..b@c.co").ok).toBe(false);
    expect(validateActivationEmail("-a@b.co").ok).toBe(false);
    expect(validateActivationEmail("+@b.co").ok).toBe(false);
    expect(validateActivationEmail("a@-b.co").ok).toBe(false);
    expect(validateActivationEmail("a@b-.co").ok).toBe(false);
    expect(validateActivationEmail("a@b.-c.co").ok).toBe(false);
  });

  it("rejects punycode domains and overlong labels", () => {
    expect(validateActivationEmail("user@xn--abc.example.com").ok).toBe(false);
    const longLabel = "a".repeat(64);
    expect(validateActivationEmail(`user@${longLabel}.example.com`).ok).toBe(false);
  });

  it("rejects overlong local part and whole address", () => {
    const longLocal = `${"a".repeat(65)}@example.com`;
    expect(validateActivationEmail(longLocal).ok).toBe(false);
    const longEmail = `${"a".repeat(243)}@example.com`;
    expect(validateActivationEmail(longEmail).ok).toBe(false);
  });

  it("rejects SQL injection attempts", () => {
    expect(validateActivationEmail("foo'; DROP TABLE accounts;--").ok).toBe(false);
  });
});

describe("assertWranglerConfigD1Binding (unit)", () => {
  const base = {
    d1_databases: [
      {
        binding: ACTIVATION_D1_BINDING,
        database_name: ACTIVATION_D1_DATABASE_NAME,
        database_id: EXPECTED_D1_ID,
      },
    ],
  };

  it("accepts exactly one WE_MET_DB entry with matching database_id", () => {
    expect(assertWranglerConfigD1Binding(base, EXPECTED_D1_ID)).toEqual({
      ok: true,
    });
    const path = validWranglerConfig();
    expect(assertWranglerConfigTargetsNonprodD1(path, EXPECTED_D1_ID)).toEqual({
      ok: true,
    });
  });

  it("refuses missing expected database id", () => {
    expect(assertWranglerConfigD1Binding(base, "").ok).toBe(false);
  });

  it("refuses production database_name", () => {
    const parsed = {
      d1_databases: [{ ...base.d1_databases[0], database_name: "we-met-db" }],
    };
    expect(assertWranglerConfigD1Binding(parsed, EXPECTED_D1_ID).ok).toBe(false);
  });

  it("refuses wrong binding name", () => {
    const parsed = {
      d1_databases: [{ ...base.d1_databases[0], binding: "OTHER" }],
    };
    expect(assertWranglerConfigD1Binding(parsed, EXPECTED_D1_ID).ok).toBe(false);
  });

  it("refuses two d1 entries", () => {
    const parsed = {
      d1_databases: [base.d1_databases[0], { ...base.d1_databases[0] }],
    };
    expect(assertWranglerConfigD1Binding(parsed, EXPECTED_D1_ID).ok).toBe(false);
  });

  it("refuses mismatched database_id", () => {
    const parsed = {
      d1_databases: [
        {
          ...base.d1_databases[0],
          database_id: "22222222-2222-2222-2222-222222222222",
        },
      ],
    };
    expect(assertWranglerConfigD1Binding(parsed, EXPECTED_D1_ID).ok).toBe(false);
  });

  it("refuses production placeholder database_id", () => {
    const parsed = {
      d1_databases: [
        { ...base.d1_databases[0], database_id: D1_PLACEHOLDER_PRODUCTION },
      ],
    };
    expect(assertWranglerConfigD1Binding(parsed, EXPECTED_D1_ID).ok).toBe(false);
  });

  it("refuses env blocks", () => {
    expect(assertWranglerConfigD1Binding({ ...base, env: {} }, EXPECTED_D1_ID).ok).toBe(
      false,
    );
  });

  it("refuses previews blocks", () => {
    expect(
      assertWranglerConfigD1Binding(
        {
          ...base,
          previews: {
            d1_databases: [{ database_name: "we-met-db" }],
          },
        },
        EXPECTED_D1_ID,
      ).ok,
    ).toBe(false);
  });

  it("refuses missing database_id", () => {
    const parsed = {
      d1_databases: [
        {
          binding: ACTIVATION_D1_BINDING,
          database_name: ACTIVATION_D1_DATABASE_NAME,
        },
      ],
    };
    expect(assertWranglerConfigD1Binding(parsed, EXPECTED_D1_ID).ok).toBe(false);
  });

  it("refuses unreadable config paths", () => {
    const missing = join(tmpdir(), "activate-staging-missing-config.jsonc");
    expect(assertWranglerConfigTargetsNonprodD1(missing, EXPECTED_D1_ID).ok).toBe(
      false,
    );
  });
});

describe("buildActivationUpdateCommand (unit)", () => {
  const iso = "2026-10-28T12:00:00.000Z";
  const email = "diadem@didi.build";

  it("places email only in the WHERE string literal", () => {
    const sql = buildActivationUpdateCommand(email, iso);
    expect(emailAppearsOnlyInWhereLiteral(sql, email)).toBe(true);
  });

  it("limits UPDATE to waitlisted and active rows", () => {
    const sql = buildActivationUpdateCommand(email, iso);
    expect(sql).toContain("AND status IN ('waitlisted', 'active')");
  });

  it("rejects a non-UTC ISO-8601 timestamp", () => {
    expect(() => buildActivationUpdateCommand(email, "2026-10-28T12:00:00Z")).toThrow(
      "updatedAtIso must be a UTC ISO-8601 string",
    );
  });
});

describe("buildWranglerD1ExecuteArgv (unit)", () => {
  it("targets remote non-prod binding with JSON output", () => {
    const argv = buildWranglerD1ExecuteArgv("wrangler.staging.ci.jsonc", "SELECT 1;");
    expect(argv).toContain("--remote");
    expect(argv).toContain("--json");
    expect(argv).toContain(ACTIVATION_D1_BINDING);
  });
});

describe("parseWranglerD1ExecuteRowChanges (unit)", () => {
  it("requires success true and meta.changes", () => {
    expect(
      parseWranglerD1ExecuteRowChanges(
        JSON.stringify([{ success: true, meta: { changes: 1 } }]),
      ),
    ).toBe(1);
    expect(
      parseWranglerD1ExecuteRowChanges(
        JSON.stringify([{ success: false, meta: { changes: 1 } }]),
      ),
    ).toBeNull();
  });

  it("returns null when stdout is not parseable", () => {
    expect(parseWranglerD1ExecuteRowChanges("not json")).toBeNull();
  });
});

describe("resolveActivationRowOutcome (unit)", () => {
  it("accepts exactly one changed row", () => {
    expect(resolveActivationRowOutcome(1)).toBe("success");
  });

  it("rejects zero, multiple, and unparseable counts", () => {
    expect(resolveActivationRowOutcome(0)).toBe("not_found");
    expect(resolveActivationRowOutcome(2)).toBe("ambiguous");
    expect(resolveActivationRowOutcome(null)).toBe("unparseable");
  });
});

describe("runActivation (unit)", () => {
  it("succeeds only when the guard passes and exactly one row changes", () => {
    const configPath = validWranglerConfig();
    const spawnSyncFn = mockSpawn(() => ({
      status: 0,
      stdout: wranglerSuccessStdout(1),
      stderr: "",
    }));
    const logs: string[] = [];
    const errors: string[] = [];
    const code = runActivation({
      email: "user@example.com",
      config: configPath,
      env: testEnv(),
      spawnSyncFn,
      now: () => new Date("2026-10-28T12:00:00.000Z"),
      maskD1DatabaseIdFn: () => {},
      maskActivationEmailForLogsFn: () => {},
      onLog: (msg) => logs.push(msg),
      onError: (msg) => errors.push(msg),
    });
    expect(code).toBe(0);
    expect(logs).toEqual(["Staging account activation succeeded."]);
    expect(spawnSyncFn).toHaveBeenCalledOnce();
    const spawnOptions = vi.mocked(spawnSyncFn).mock.calls[0]?.[2];
    expect(spawnOptions).toEqual(WRANGLER_D1_EXECUTE_SPAWN_OPTIONS);
    expect(spawnOptions?.shell).toBe(false);
  });

  it("fails before spawn when the D1 guard rejects the config", () => {
    const configPath = writeWranglerConfig({
      d1_databases: [
        {
          binding: ACTIVATION_D1_BINDING,
          database_name: "we-met-db",
          database_id: EXPECTED_D1_ID,
        },
      ],
    });
    const spawnSyncFn = vi.fn();
    const code = runActivation({
      email: "user@example.com",
      config: configPath,
      env: testEnv(),
      spawnSyncFn,
      maskD1DatabaseIdFn: () => {},
      maskActivationEmailForLogsFn: () => {},
    });
    expect(code).toBe(1);
    expect(spawnSyncFn).not.toHaveBeenCalled();
  });

  it("fails when meta.changes is zero despite wrangler exiting zero", () => {
    const configPath = validWranglerConfig();
    const code = runActivation({
      email: "user@example.com",
      config: configPath,
      env: testEnv(),
      spawnSyncFn: mockSpawn(() => ({
        status: 0,
        stdout: wranglerSuccessStdout(0),
        stderr: "",
      })),
      maskD1DatabaseIdFn: () => {},
      maskActivationEmailForLogsFn: () => {},
    });
    expect(code).toBe(1);
  });

  it("does not forward wrangler stdout or stderr through process or console sinks", () => {
    const configPath = validWranglerConfig();
    const wranglerPayload = "leaked-from-wrangler@example.com";
    const rawEmail = "Operator@Example.com";
    const io = captureIo();
    try {
      runActivation({
        email: rawEmail,
        config: configPath,
        env: testEnv(),
        spawnSyncFn: mockSpawn(() => ({
          status: 0,
          stdout: JSON.stringify([
            {
              success: true,
              meta: { changes: 1 },
              debug: wranglerPayload,
            },
          ]),
          stderr: "stderr-noise-from-wrangler",
        })),
        now: () => new Date("2026-10-28T12:00:00.000Z"),
        maskD1DatabaseIdFn: () => {},
        maskActivationEmailForLogsFn: () => {},
      });
      expectIoExcludesWranglerAndRawEmail(io, rawEmail, wranglerPayload);
      expect(io.allText()).not.toContain("stderr-noise-from-wrangler");
    } finally {
      io.restore();
    }
  });

  it("rejects invalid email before spawn is called", () => {
    const spawnSyncFn = vi.fn();
    const io = captureIo();
    try {
      const code = runActivation({
        email: "not-an-email",
        config: validWranglerConfig(),
        env: testEnv(),
        spawnSyncFn,
        maskD1DatabaseIdFn: () => {},
        maskActivationEmailForLogsFn: () => {},
      });
      expect(code).toBe(1);
      expect(spawnSyncFn).not.toHaveBeenCalled();
    } finally {
      io.restore();
    }
  });

  it("uses the normalized email in wrangler SQL argv", () => {
    const configPath = validWranglerConfig();
    const spawnSyncFn = mockSpawn(() => ({
      status: 0,
      stdout: wranglerSuccessStdout(1),
      stderr: "",
    }));
    runActivation({
      email: "Operator@Example.com",
      config: configPath,
      env: testEnv(),
      spawnSyncFn,
      now: () => new Date("2026-10-28T12:00:00.000Z"),
      maskD1DatabaseIdFn: () => {},
      maskActivationEmailForLogsFn: () => {},
    });
    const argv = vi.mocked(spawnSyncFn).mock.calls[0]?.[1] as string[] | undefined;
    const sql = argv?.[argv.indexOf("--command") + 1];
    expect(sql).toContain("operator@example.com");
    expect(sql).not.toContain("Operator@Example.com");
  });

  it("reports a safe wrangler failure with exit code only", () => {
    const io = captureIo();
    try {
      const code = runActivation({
        email: "user@example.com",
        config: validWranglerConfig(),
        env: testEnv(),
        spawnSyncFn: mockSpawn(() => ({
          status: 42,
          stdout: "secret-d1-id-in-wrangler-output",
          stderr: "operator@example.com leaked",
        })),
        maskD1DatabaseIdFn: () => {},
        maskActivationEmailForLogsFn: () => {},
      });
      expect(code).toBe(42);
      expect(io.allText()).toContain(
        "Staging account activation failed: database command error (exit 42).",
      );
      expect(io.allText()).not.toContain("secret-d1-id-in-wrangler-output");
      expect(io.allText()).not.toContain("operator@example.com leaked");
    } finally {
      io.restore();
    }
  });

  it("masks the operator email before D1 execute", () => {
    const configPath = validWranglerConfig();
    const masked: string[] = [];
    runActivation({
      email: "Operator@Example.com",
      config: configPath,
      env: testEnv(),
      spawnSyncFn: mockSpawn(() => ({
        status: 0,
        stdout: wranglerSuccessStdout(1),
        stderr: "",
      })),
      maskD1DatabaseIdFn: () => {},
      maskActivationEmailForLogsFn: (email) => masked.push(email),
    });
    expect(masked).toEqual(["operator@example.com"]);
  });

  it("passes SQL as a single argv element with shell disabled", () => {
    const configPath = validWranglerConfig();
    const spawnSyncFn = mockSpawn(() => ({
      status: 0,
      stdout: wranglerSuccessStdout(1),
      stderr: "",
    }));
    runActivation({
      email: "user@example.com",
      config: configPath,
      env: testEnv(),
      spawnSyncFn,
      now: () => new Date("2026-10-28T12:00:00.000Z"),
      maskD1DatabaseIdFn: () => {},
      maskActivationEmailForLogsFn: () => {},
    });
    const argv = vi.mocked(spawnSyncFn).mock.calls[0]?.[1] as string[] | undefined;
    const sql = buildActivationUpdateCommand(
      "user@example.com",
      "2026-10-28T12:00:00.000Z",
    );
    expect(argv).toEqual(buildWranglerD1ExecuteArgv(configPath, sql));
    expect(vi.mocked(spawnSyncFn).mock.calls[0]?.[2]).toMatchObject({ shell: false });
  });
});

describe("readWorkflowDispatchEmailFromGithubEvent (unit)", () => {
  it("rejects newline in event email before trimming", () => {
    const result = readWorkflowDispatchEmailFromGithubEvent("event.json", () =>
      JSON.stringify({ inputs: { email: "qa@example.com\n::warning::x" } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(ACTIVATION_EVENT_EMAIL_CONTROL_REJECTED);
    }
  });

  it("rejects carriage return in event email before trimming", () => {
    const result = readWorkflowDispatchEmailFromGithubEvent("event.json", () =>
      JSON.stringify({ inputs: { email: "qa@example.com\r\n" } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(ACTIVATION_EVENT_EMAIL_CONTROL_REJECTED);
    }
  });
});

describe("runActivationFromCliOrEvent (unit)", () => {
  it("masks raw dispatch email before any other output when reading GITHUB_EVENT_PATH", () => {
    const eventDir = mkdtempSync(join(tmpdir(), "activate-event-"));
    const eventPath = join(eventDir, "github-event.json");
    try {
      writeFileSync(eventPath, JSON.stringify({ inputs: { email: "QA@Example.com" } }));
      const outputLines: string[] = [];
      const logLine = (line: string) => {
        outputLines.push(line);
      };
      const logError = (line: string) => {
        outputLines.push(line);
      };
      runActivationFromCliOrEvent({
        config: validWranglerConfig(),
        env: testEnv({ GITHUB_EVENT_PATH: eventPath }),
        logLine,
        logError,
        spawnSyncFn: mockSpawn(() => ({
          status: 0,
          stdout: wranglerSuccessStdout(1),
          stderr: "",
        })),
        maskD1DatabaseIdFn: () => {},
        maskActivationEmailForLogsFn: () => {},
        now: () => new Date("2026-10-28T12:00:00.000Z"),
      });
      expect(outputLines[0]).toBe("::add-mask::QA@Example.com");
      expect(outputLines[1]).toBe("::add-mask::qa@example.com");
      expect(outputLines[0]).not.toBe("::add-mask::qa@example.com");
    } finally {
      rmSync(eventDir, { recursive: true, force: true });
    }
  });

  it("rejects control characters without echoing the dispatch email", () => {
    const eventDir = mkdtempSync(join(tmpdir(), "activate-event-"));
    const eventPath = join(eventDir, "github-event.json");
    const poison = "qa@example.com\n::warning::injected";
    try {
      writeFileSync(eventPath, JSON.stringify({ inputs: { email: poison } }));
      const outputLines: string[] = [];
      const code = runActivationFromCliOrEvent({
        config: validWranglerConfig(),
        env: testEnv({ GITHUB_EVENT_PATH: eventPath }),
        logLine: (line) => {
          outputLines.push(line);
        },
        logError: (line) => {
          outputLines.push(line);
        },
        spawnSyncFn: mockSpawn(() => ({
          status: 0,
          stdout: wranglerSuccessStdout(1),
          stderr: "",
        })),
        maskD1DatabaseIdFn: () => {},
        maskActivationEmailForLogsFn: () => {},
        now: () => new Date("2026-10-28T12:00:00.000Z"),
      });
      expect(code).not.toBe(0);
      expect(outputLines).toHaveLength(1);
      expect(outputLines[0]).toBe(
        `Activation email rejected: ${ACTIVATION_EVENT_EMAIL_CONTROL_REJECTED}`,
      );
      expect(outputLines.join("\n")).not.toContain("qa@example.com");
      expect(outputLines.join("\n")).not.toContain("::warning::");
    } finally {
      rmSync(eventDir, { recursive: true, force: true });
    }
  });
});

describe("activate-staging-account CLI (unit)", () => {
  it("prints usage when --email has no value", () => {
    const result = nodeSpawnSync(
      "node",
      [
        "scripts/activate-staging-account.mjs",
        "--email",
        "--config",
        validWranglerConfig(),
      ],
      { encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Usage: activate-staging-account.mjs --config");
  });
});

describe("Activate staging account workflow structure (unit)", () => {
  const workflow = readFileSync(
    ".github/workflows/activate-staging-account.yml",
    "utf8",
  );

  it("only triggers on workflow_dispatch", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+pull_request:/m);
    expect(workflow).not.toMatch(/^\s+push:/m);
  });

  it("limits permissions to exactly contents read at every level", () => {
    expect(workflowPermissionsAllowOnly(workflow, { contents: "read" })).toBe(true);
  });

  it("runs the main branch ref guard before activation", () => {
    const mainRefIdx = workflow.indexOf("name: Require main branch ref");
    const activateIdx = workflow.indexOf("Activate waitlisted account in non-prod D1");
    expect(mainRefIdx).toBeGreaterThan(-1);
    expect(activateIdx).toBeGreaterThan(mainRefIdx);
  });

  it("checks out main only after the step-level main ref guard", () => {
    expect(workflow).toContain("name: Require main branch ref");
    expect(workflow).toMatch(
      /name: Require main branch ref[\s\S]*?\$\{GITHUB_REF\}" != "refs\/heads\/main"[\s\S]*?exit 1/,
    );
  });

  it("requires main ref, staging environment, timeout, and main checkout", () => {
    const job = workflow.match(/^  activate:[\s\S]*$/m)?.[0] ?? "";
    expect(job).toContain("if: github.ref == 'refs/heads/main'");
    expect(job).toContain("environment: staging");
    expect(job).toContain("timeout-minutes: 10");
    expect(workflow).toContain("ref: main");
  });

  it("runs deploy guards before activation", () => {
    const guardsIdx = workflow.indexOf("Deploy-time guards (staging D1 binding)");
    const activateIdx = workflow.indexOf("Activate waitlisted account in non-prod D1");
    expect(guardsIdx).toBeGreaterThan(-1);
    expect(activateIdx).toBeGreaterThan(guardsIdx);
    expect(workflow).toContain(
      "check-deploy-guards.mjs --target staging --config wrangler.staging.ci.jsonc",
    );
  });

  it("run-line regex matches list-item run steps in this workflow", () => {
    const scripts = activationWorkflowRunScripts(workflow);
    expect(scripts).toContain("      - run: npm ci");
  });

  it("run-block regex captures multiline script bodies", () => {
    const runBlocks = workflow.match(ACTIVATION_WORKFLOW_RUN_BLOCK) ?? [];
    expect(runBlocks.length).toBeGreaterThanOrEqual(3);
    expect(
      runBlocks.some((block) =>
        block.includes("node scripts/activate-staging-account.mjs"),
      ),
    ).toBe(true);
    expect(runBlocks.every((block) => block.includes("\n"))).toBe(true);
  });

  it("does not leak dispatch email via workflow expressions or shell event reads", () => {
    expect(workflow).not.toContain("inputs.email");
    expect(workflow).not.toContain("ACTIVATE_EMAIL");
    expect(workflow).not.toContain("github.event.inputs");
    expect(workflow).not.toMatch(/tojson\s*\(\s*github\.event/i);
    expect(workflow).not.toContain("inputs[");
    for (const block of activationWorkflowRunScripts(workflow)) {
      expect(block).not.toContain("GITHUB_EVENT_PATH");
    }
  });

  it("does not interpolate workflow inputs or secrets inside run scripts", () => {
    for (const block of activationWorkflowRunScripts(workflow)) {
      expect(block).not.toMatch(/\$\{\{\s*inputs\./);
      expect(block).not.toMatch(/\$\{\{\s*secrets\./);
    }
  });

  it("does not reference production resources or write a job summary", () => {
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
    expect(workflow).not.toMatch(/environment:\s*production/m);
    expect(workflow.replace(/we-met-db-nonprod/g, "")).not.toContain("we-met-db");
    expect(workflow).not.toContain("GITHUB_STEP_SUMMARY");
  });
});
