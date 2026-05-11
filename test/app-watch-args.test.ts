import { describe, expect, it } from "vitest";

import { createDefaultAppWatchArgs } from "../src/cli/app-watch-args.js";

describe("createDefaultAppWatchArgs", () => {
  it("baselines existing Granola transcripts for interactive interviews", () => {
    expect(createDefaultAppWatchArgs("/granola")).toEqual({
      granolaDir: "/granola",
      intervalMs: 2000,
      changesOnly: true,
      json: false,
      summary: true,
      transcriptDocumentId: null,
      keychainService: "Granola Safe Storage",
      keychainAccount: "Granola Key",
      help: false,
    });
  });
});
