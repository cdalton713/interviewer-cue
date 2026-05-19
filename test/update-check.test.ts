import { describe, expect, it, vi } from "vitest";

import {
  buildGlobalInstallCommand,
  detectGlobalPackageManager,
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
        packageManager: "npm",
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
    expect(install).toHaveBeenCalledWith("interviewer-cue@latest", "npm");
  });

  it("uses pnpm for updates when the active global install came from pnpm", async () => {
    const install = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      runUpdateCheck({
        currentVersion: "0.1.0",
        mode: "startup",
        env: { PNPM_HOME: "/Users/me/Library/pnpm" },
        argv: [
          "/opt/homebrew/bin/node",
          "/Users/me/Library/pnpm/global/5/node_modules/interviewer-cue/dist/cli/interviewer-cue.js",
        ],
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
    expect(install).toHaveBeenCalledWith("interviewer-cue@latest", "pnpm");
  });

  it("uses yarn for updates when the active global install came from yarn", async () => {
    const install = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      runUpdateCheck({
        currentVersion: "0.1.0",
        mode: "startup",
        env: { npm_config_user_agent: "yarn/1.22.22 npm/? node/v20.0.0" },
        argv: ["/usr/local/bin/node", "/Users/me/.config/yarn/global/node_modules/.bin/interviewer-cue"],
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
    expect(install).toHaveBeenCalledWith("interviewer-cue@latest", "yarn");
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

describe("detectGlobalPackageManager", () => {
  it("detects pnpm from package-manager environment and global paths", () => {
    expect(
      detectGlobalPackageManager({
        env: { npm_config_user_agent: "pnpm/10.0.0 node/v20.0.0" },
        argv: [],
      }),
    ).toBe("pnpm");
    expect(
      detectGlobalPackageManager({
        env: { PNPM_HOME: "/Users/me/Library/pnpm" },
        argv: ["/usr/local/bin/node", "/Users/me/Library/pnpm/interviewer-cue"],
      }),
    ).toBe("pnpm");
  });

  it("detects yarn from package-manager environment and global paths", () => {
    expect(
      detectGlobalPackageManager({
        env: { npm_config_user_agent: "yarn/1.22.22 npm/? node/v20.0.0" },
        argv: [],
      }),
    ).toBe("yarn");
    expect(
      detectGlobalPackageManager({
        env: {},
        argv: ["/usr/local/bin/node", "/Users/me/.config/yarn/global/node_modules/interviewer-cue"],
      }),
    ).toBe("yarn");
  });

  it("defaults to npm when there is no pnpm evidence", () => {
    expect(detectGlobalPackageManager({ env: {}, argv: [] })).toBe("npm");
  });
});

describe("buildGlobalInstallCommand", () => {
  it("builds the global install command for the selected package manager", () => {
    expect(buildGlobalInstallCommand("interviewer-cue@latest", "npm")).toEqual({
      command: "npm",
      args: ["install", "-g", "interviewer-cue@latest"],
    });
    expect(buildGlobalInstallCommand("interviewer-cue@latest", "pnpm")).toEqual({
      command: "pnpm",
      args: ["add", "-g", "interviewer-cue@latest"],
    });
    expect(buildGlobalInstallCommand("interviewer-cue@latest", "yarn")).toEqual({
      command: "yarn",
      args: ["global", "add", "interviewer-cue@latest"],
    });
  });
});

function silentOutput() {
  return {
    log: vi.fn(),
    error: vi.fn(),
  };
}
