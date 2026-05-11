import { describe, expect, it } from "vitest";

import { getWatchHelp, parseWatchArgs } from "../src/granola/watch-args.js";

describe("parseWatchArgs", () => {
  it("accepts interval and cache options", () => {
    const args = parseWatchArgs(
      ["--interval-ms", "1000", "--granola-dir", "/tmp/granola", "--emit-existing"],
      "/granola",
    );

    expect(args.intervalMs).toBe(1000);
    expect(args.granolaDir).toBe("/tmp/granola");
    expect(args.changesOnly).toBe(false);
  });

  it("preloads existing transcript entries by default", () => {
    expect(parseWatchArgs([], "/granola").changesOnly).toBe(false);
  });

  it("supports changes-only mode", () => {
    expect(parseWatchArgs(["--changes-only"], "/granola").changesOnly).toBe(true);
  });

  it("keeps emit-existing as a backwards-compatible preload alias", () => {
    expect(parseWatchArgs(["--emit-existing"], "/granola").changesOnly).toBe(false);
  });

  it("rejects very tight polling", () => {
    expect(() => parseWatchArgs(["--interval-ms", "100"], "/granola")).toThrow(
      />= 250/,
    );
  });

  it("reports commander validation errors for invalid interval values", () => {
    expect(() => parseWatchArgs(["--interval-ms", "fast"], "/granola")).toThrow(
      /--interval-ms must be a number >= 250/,
    );
  });

  it("keeps watch help available for the CLI entrypoint", () => {
    expect(parseWatchArgs(["--help"], "/granola").help).toBe(true);
    expect(getWatchHelp()).toContain("--interval-ms <ms>");
    expect(getWatchHelp()).toContain("--changes-only");
    expect(getWatchHelp()).toContain("--granola-dir <path>");
  });
});
