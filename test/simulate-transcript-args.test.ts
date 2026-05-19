import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import { vi } from "vitest";

import {
  bindSimulationReplayControls,
  getSimulateHelp,
  parseSimulateArgs,
} from "../src/cli/simulate-transcript.js";

describe("simulate transcript args", () => {
  it("replays Granola cache transcripts by default", () => {
    const args = parseSimulateArgs([]);
    const help = getSimulateHelp();

    expect(args).toMatchObject({
      transcriptDocumentId: null,
      stepSeconds: 30,
      granolaDir: expect.stringContaining("Granola"),
      keychainService: "Granola Safe Storage",
      keychainAccount: "Granola Key",
    });
    expect(help).toContain("--transcript <documentId>");
    expect(help).toContain("--step-seconds <seconds>");
    expect(help).toContain("--granola-dir <path>");
    expect(help).not.toContain("--scenario");
  });

  it("supports non-interactive transcript selection and custom step intervals", () => {
    expect(
      parseSimulateArgs([
        "--transcript",
        "docA",
        "--step-seconds",
        "15",
        "--granola-dir",
        "/tmp/granola",
      ]),
    ).toMatchObject({
      transcriptDocumentId: "docA",
      stepSeconds: 15,
      granolaDir: "/tmp/granola",
    });
  });

  it("rejects invalid replay step intervals", () => {
    expect(() => parseSimulateArgs(["--step-seconds", "0"])).toThrow(
      /--step-seconds must be a number >= 1/,
    );
  });

  it("resumes stdin before listening for replay step keypresses", async () => {
    const input = new EventEmitter() as EventEmitter & {
      isTTY: true;
      setRawMode: ReturnType<typeof vi.fn>;
      resume: ReturnType<typeof vi.fn>;
    };
    input.isTTY = true;
    input.setRawMode = vi.fn();
    input.resume = vi.fn();
    const server = {
      advance: vi.fn().mockResolvedValue({
        added: [{ key: "docA:utt1" }],
        updated: [],
      }),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const log = vi.fn();

    bindSimulationReplayControls({ input, server, log });
    input.emit("keypress", "n", { name: "n" });
    await Promise.resolve();

    expect(input.setRawMode).toHaveBeenCalledWith(true);
    expect(input.resume).toHaveBeenCalledOnce();
    expect(server.advance).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("Emitted 1 utterance event(s).");
  });
});
