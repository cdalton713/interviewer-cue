import { describe, expect, it, vi } from "vitest";

import {
  shouldSkipUpdateCheck,
  runUpdateCheck,
} from "../src/cli/update-check.js";

describe("shouldSkipUpdateCheck", () => {
  it("honors CLI and environment escape hatches", () => {
    expect(
      shouldSkipUpdateCheck({
        argv: ["--no-update-check"],
        env: {},
      }),
    ).toBe(true);
    expect(
      shouldSkipUpdateCheck({
        argv: [],
        env: { INTERVIEWER_CUE_SKIP_UPDATE: "1" },
      }),
    ).toBe(true);
    expect(shouldSkipUpdateCheck({ argv: [], env: {} })).toBe(false);
  });
});

describe("runUpdateCheck", () => {
  it("continues when the npm registry reports the current version", async () => {
    const install = vi.fn();

    await expect(
      runUpdateCheck({
        currentVersion: "0.1.0",
        mode: "startup",
        fetchJson: async () => ({ version: "0.1.0" }),
        confirm: async () => true,
        install,
        output: silentOutput(),
      }),
    ).resolves.toEqual({ status: "up-to-date", latestVersion: "0.1.0" });
    expect(install).not.toHaveBeenCalled();
  });

  it("continues startup when an update is available and the user declines", async () => {
    const install = vi.fn();

    await expect(
      runUpdateCheck({
        currentVersion: "0.1.0",
        mode: "startup",
        fetchJson: async () => ({ version: "0.2.0" }),
        confirm: async () => false,
        install,
        output: silentOutput(),
      }),
    ).resolves.toEqual({
      status: "declined",
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
    });
    expect(install).not.toHaveBeenCalled();
  });

  it("installs the latest package when the user accepts", async () => {
    const install = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      runUpdateCheck({
        currentVersion: "0.1.0",
        mode: "startup",
        fetchJson: async (url) =>
          url.includes("npmjs")
            ? { version: "0.2.0" }
            : { name: "Release 0.2.0", html_url: "https://example.com/r" },
        confirm: async () => true,
        install,
        output: silentOutput(),
      }),
    ).resolves.toEqual({
      status: "installed",
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
    });
    expect(install).toHaveBeenCalledWith("interviewer-cue@latest");
  });

  it("does not block startup when the registry request fails", async () => {
    const install = vi.fn();

    await expect(
      runUpdateCheck({
        currentVersion: "0.1.0",
        mode: "startup",
        fetchJson: async () => {
          throw new Error("network down");
        },
        confirm: async () => true,
        install,
        output: silentOutput(),
      }),
    ).resolves.toEqual({ status: "failed", error: expect.any(Error) });
    expect(install).not.toHaveBeenCalled();
  });
});

function silentOutput() {
  return {
    log: vi.fn(),
    error: vi.fn(),
  };
}
