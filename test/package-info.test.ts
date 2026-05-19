import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PACKAGE_VERSION } from "../src/cli/package-info.js";

describe("package info", () => {
  it("keeps the embedded CLI version in sync with package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      version?: unknown;
    };

    expect(PACKAGE_VERSION).toBe(pkg.version);
  });
});
