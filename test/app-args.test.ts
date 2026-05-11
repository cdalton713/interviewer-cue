import { describe, expect, it } from "vitest";

import { getAppHelp, parseAppArgs } from "../src/cli/app-args.js";

describe("parseAppArgs", () => {
  it("leaves the AI model unset by default so app settings can choose it", () => {
    expect(parseAppArgs([])).toEqual({
      modelId: undefined,
      pdfModelId: undefined,
      liveModelId: undefined,
      resumePath: undefined,
      interviewTypeId: undefined,
      transcriptSource: "granola",
      simulationUrl: "tcp://127.0.0.1:4767",
      help: false,
    });
  });

  it("parses model, resume, interview type, and simulation options", () => {
    expect(
      parseAppArgs([
        "--model",
        "google:gemini-2.5-flash",
        "--resume",
        "/tmp/resume.pdf",
        "--interview-type",
        "technical",
        "--transcript-source",
        "simulation",
        "--simulation-url",
        "tcp://127.0.0.1:5999",
      ]),
    ).toEqual({
      modelId: "google:gemini-2.5-flash",
      pdfModelId: undefined,
      liveModelId: undefined,
      resumePath: "/tmp/resume.pdf",
      interviewTypeId: "technical",
      transcriptSource: "simulation",
      simulationUrl: "tcp://127.0.0.1:5999",
      help: false,
    });
  });

  it("parses separate PDF and live model overrides", () => {
    expect(
      parseAppArgs([
        "--pdf-model",
        "openai:gpt-5",
        "--live-model",
        "google:gemini-2.5-flash",
      ]),
    ).toEqual({
      modelId: undefined,
      pdfModelId: "openai:gpt-5",
      liveModelId: "google:gemini-2.5-flash",
      resumePath: undefined,
      interviewTypeId: undefined,
      transcriptSource: "granola",
      simulationUrl: "tcp://127.0.0.1:4767",
      help: false,
    });
  });

  it("rejects invalid transcript sources", () => {
    expect(() =>
      parseAppArgs(["--transcript-source", "microphone"]),
    ).toThrow(/invalid transcript source/i);
  });

  it("uses the public command name in help output", () => {
    expect(getAppHelp()).toContain("Usage: interviewer-cue");
  });
});
