import { describe, expect, it } from "vitest";

import {
  buildReleasePlan,
  parseReleaseArgs,
} from "../scripts/release.mjs";

describe("release script", () => {
  it("defaults to a patch release without pushing", () => {
    const args = parseReleaseArgs([]);

    expect(args).toEqual({
      bump: "patch",
      dryRun: false,
      push: false,
      skipVerify: false,
    });
  });

  it("accepts semver bumps, exact versions, and flags", () => {
    const args = parseReleaseArgs(["minor", "--dry-run", "--push", "--skip-verify"]);

    expect(args).toEqual({
      bump: "minor",
      dryRun: true,
      push: true,
      skipVerify: true,
    });

    expect(parseReleaseArgs(["1.2.3"]).bump).toBe("1.2.3");
  });

  it("rejects invalid release arguments", () => {
    expect(() => parseReleaseArgs(["banana"])).toThrow(
      "Release must be patch, minor, major, or an exact x.y.z version",
    );
    expect(() => parseReleaseArgs(["patch", "minor"])).toThrow(
      "Only one release bump/version may be provided",
    );
    expect(() => parseReleaseArgs(["--unknown"])).toThrow("Unknown option: --unknown");
  });

  it("builds the checked command plan for a pushed release", () => {
    const plan = buildReleasePlan({
      bump: "patch",
      dryRun: false,
      push: true,
      skipVerify: false,
    });

    expect(plan.map((step) => step.label)).toEqual([
      "Check clean working tree",
      "Bump package version",
      "Refresh lockfile",
      "Run tests",
      "Typecheck",
      "Build",
      "Verify package contents",
      "Stage release files",
      "Commit release",
      "Create annotated tag",
      "Push branch",
      "Push tag",
    ]);
  });

  it("omits mutating commands for dry runs", () => {
    const plan = buildReleasePlan({
      bump: "major",
      dryRun: true,
      push: true,
      skipVerify: true,
    });

    expect(plan.map((step) => step.label)).toEqual([
      "Check clean working tree",
      "Bump package version",
      "Refresh lockfile",
      "Stage release files",
      "Commit release",
      "Create annotated tag",
      "Push branch",
      "Push tag",
    ]);
    expect(plan.every((step) => step.dryRunOnly)).toBe(true);
  });
});
