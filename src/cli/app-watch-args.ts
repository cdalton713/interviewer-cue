import type { WatchArgs } from "../granola/types.js";

export function createDefaultAppWatchArgs(granolaDir: string): WatchArgs {
  return {
    granolaDir,
    intervalMs: 2000,
    changesOnly: true,
    json: false,
    summary: true,
    transcriptDocumentId: null,
    keychainService: "Granola Safe Storage",
    keychainAccount: "Granola Key",
    help: false,
  };
}
