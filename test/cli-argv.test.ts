import { describe, expect, it } from "vitest";

import { normalizeScriptArgv } from "../src/cli/argv.js";

describe("normalizeScriptArgv", () => {
  it("drops a pnpm separator before command arguments", () => {
    expect(normalizeScriptArgv(["--", "--summary"])).toEqual(["--summary"]);
  });

  it("leaves normal command arguments unchanged", () => {
    expect(normalizeScriptArgv(["--summary"])).toEqual(["--summary"]);
  });
});
