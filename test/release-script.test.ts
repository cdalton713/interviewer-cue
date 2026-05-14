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
      otp: undefined,
      publish: false,
      push: false,
      skipVerify: false,
    });
  });

  it("accepts semver bumps, exact versions, and flags", () => {
    const args = parseReleaseArgs(["minor", "--dry-run", "--publish", "--push", "--skip-verify"]);

    expect(args).toEqual({
      bump: "minor",
      dryRun: true,
      otp: undefined,
      publish: true,
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
    expect(() => parseReleaseArgs(["--otp"])).toThrow("Missing value for --otp");
    expect(() => parseReleaseArgs(["--otp", "--publish"])).toThrow("Missing value for --otp");
  });

  it("passes an npm one-time password to publish", () => {
    const args = parseReleaseArgs(["patch", "--publish", "--otp", "123456"]);

    expect(args).toEqual({
      bump: "patch",
      dryRun: false,
      otp: "123456",
      publish: true,
      push: false,
      skipVerify: false,
    });

    const plan = buildReleasePlan(args);

    expect(plan.find((step) => step.label === "Publish to npm")?.command).toEqual([
      "npm",
      "publish",
      "--otp",
      "123456",
    ]);
  });

  it("builds the checked command plan for a locally published release", () => {
    const plan = buildReleasePlan({
      bump: "patch",
      dryRun: false,
      publish: true,
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
      "Publish to npm",
      "Push branch",
      "Push tag",
    ]);
  });

  it("omits mutating commands for dry runs", () => {
    const plan = buildReleasePlan({
      bump: "major",
      dryRun: true,
      publish: true,
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
      "Publish to npm",
      "Push branch",
      "Push tag",
    ]);
    expect(plan.every((step) => step.dryRunOnly)).toBe(true);
  });
});
