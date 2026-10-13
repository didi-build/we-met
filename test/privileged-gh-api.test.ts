import { describe, expect, it } from "vitest";
import { buildGhApiArgs } from "../scripts/lib/privileged-gh-api.mjs";

describe("privileged-gh-api buildGhApiArgs (table)", () => {
  const cases: {
    args: string[];
    hasInput: boolean;
    expected: string[];
  }[] = [
    {
      args: ["repos/o/r/pulls/1"],
      hasInput: false,
      expected: ["api", "repos/o/r/pulls/1"],
    },
    {
      args: ["--method", "POST", "repos/o/r/issues/1/comments"],
      hasInput: true,
      expected: [
        "api",
        "--method",
        "POST",
        "repos/o/r/issues/1/comments",
        "--input",
        "-",
      ],
    },
  ];

  for (const { args, hasInput, expected } of cases) {
    it(`${hasInput ? "with" : "without"} input: ${args.join(" ")}`, () => {
      expect(buildGhApiArgs(args, hasInput)).toEqual(expected);
    });
  }
});
