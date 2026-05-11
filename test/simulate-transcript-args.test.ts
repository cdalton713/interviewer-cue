import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getSimulateHelp,
  parseSimulateArgs,
} from "../src/cli/simulate-transcript.js";

describe("simulate transcript args", () => {
  it("uses a bundled default scenario without exposing the workspace path in help", () => {
    const args = parseSimulateArgs([]);
    const help = getSimulateHelp();

    expect(args.scenario.split(path.sep).join("/")).toContain(
      "fixtures/simulation/technical-interview.md",
    );
    expect(help).toContain("default: bundled demo");
    expect(help).not.toContain(process.cwd());
  });
});
