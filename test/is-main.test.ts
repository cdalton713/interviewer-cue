import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { isMain } from "../src/cli/is-main.js";

describe("isMain", () => {
  it("rejects bundled imports whose source entry name does not match argv", () => {
    const bundledEntrypoint = "/repo/dist/cli/interviewer-cue.js";

    expect(
      isMain(pathToFileURL(bundledEntrypoint).href, ["node", bundledEntrypoint], "decrypt"),
    ).toBe(false);
  });

  it("accepts direct source and built entrypoints when the entry name matches", () => {
    expect(
      isMain(
        pathToFileURL("/repo/src/cli/decrypt.ts").href,
        ["node", "/repo/src/cli/decrypt.ts"],
        "decrypt",
      ),
    ).toBe(true);
    expect(
      isMain(
        pathToFileURL("/repo/dist/cli/decrypt.js").href,
        ["node", "/repo/dist/cli/decrypt.js"],
        "decrypt",
      ),
    ).toBe(true);
  });
});
