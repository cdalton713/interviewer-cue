import { describe, expect, it } from "vitest";

import {
  getDecryptHelp,
  parseDecryptArgs,
  summarizeCache,
} from "../src/granola/cache-cli.js";

describe("parseDecryptArgs", () => {
  it("defaults to summary mode", () => {
    expect(parseDecryptArgs([], "/granola")).toEqual({
      granolaDir: "/granola",
      json: false,
      summary: true,
      transcriptDocumentId: null,
      keychainService: "Granola Safe Storage",
      keychainAccount: "Granola Key",
      help: false,
    });
  });

  it("supports transcript mode", () => {
    expect(parseDecryptArgs(["--transcript", "doc-1"], "/granola")).toEqual({
      granolaDir: "/granola",
      json: false,
      summary: false,
      transcriptDocumentId: "doc-1",
      keychainService: "Granola Safe Storage",
      keychainAccount: "Granola Key",
      help: false,
    });
  });

  it("reports commander validation errors without exiting the process", () => {
    expect(() => parseDecryptArgs(["--wat"], "/granola")).toThrow(
      /unknown option '--wat'/i,
    );
  });

  it("keeps help text available for the CLI entrypoint", () => {
    expect(getDecryptHelp()).toContain("Usage:");
    expect(getDecryptHelp()).toContain("--granola-dir <path>");
  });
});

describe("summarizeCache", () => {
  it("counts documents and transcripts without transcript text", () => {
    const summary = summarizeCache({
      cache: {
        version: 6,
        state: {
          documents: { "doc-1": {} },
          sharedDocuments: { "doc-2": {} },
          transcripts: {
            "doc-1": [
              {
                id: "utt-1",
                end_timestamp: "2026-05-11T10:00:00.000Z",
                source: "microphone",
                is_final: false,
                text: "private text",
              },
            ],
          },
        },
      },
    });

    expect(summary.documents).toBe(1);
    expect(summary.sharedDocuments).toBe(1);
    expect(summary.transcriptDocuments).toBe(1);
    expect(summary.utterances).toBe(1);
    expect(summary.interimUtterances).toBe(1);
    expect(summary.latest[0]?.textLength).toBe(12);
    expect(summary.latest[0]).not.toHaveProperty("text");
  });
});
