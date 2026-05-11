import { describe, expect, it } from "vitest";

import {
  getInterviewerCueHelp,
  parseInterviewerCueArgs,
} from "../src/cli/interviewer-cue-args.js";

describe("parseInterviewerCueArgs", () => {
  it("routes bare invocation to the Ink app", () => {
    expect(parseInterviewerCueArgs([])).toEqual({
      command: "app",
      args: [],
      noUpdateCheck: false,
      help: false,
    });
  });

  it("strips the launch update opt-out before app args are parsed", () => {
    expect(
      parseInterviewerCueArgs([
        "--no-update-check",
        "--resume",
        "/tmp/resume.pdf",
      ]),
    ).toEqual({
      command: "app",
      args: ["--resume", "/tmp/resume.pdf"],
      noUpdateCheck: true,
      help: false,
    });
  });

  it("routes Granola cache subcommands under the provider namespace", () => {
    expect(
      parseInterviewerCueArgs(["granola", "decrypt-cache", "--summary"]),
    ).toEqual({
      command: "granolaDecryptCache",
      args: ["--summary"],
      noUpdateCheck: false,
      help: false,
    });

    expect(
      parseInterviewerCueArgs(["granola", "watch-cache", "--changes-only"]),
    ).toEqual({
      command: "granolaWatchCache",
      args: ["--changes-only"],
      noUpdateCheck: false,
      help: false,
    });
  });

  it("routes simulation and manual update commands", () => {
    expect(parseInterviewerCueArgs(["simulate-transcript", "--help"])).toEqual({
      command: "simulate-transcript",
      args: ["--help"],
      noUpdateCheck: false,
      help: false,
    });

    expect(parseInterviewerCueArgs(["update"])).toEqual({
      command: "update",
      args: [],
      noUpdateCheck: false,
      help: false,
    });
  });

  it("exposes productized help text", () => {
    const help = getInterviewerCueHelp();

    expect(help).toContain("Usage: interviewer-cue");
    expect(help).toContain("interviewer-cue granola decrypt-cache");
    expect(help).toContain("interviewer-cue simulate-transcript");
    expect(help).toContain("--no-update-check");
  });
});
