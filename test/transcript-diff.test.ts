import { describe, expect, it } from "vitest";

import {
  diffTranscriptState,
  flattenTranscripts,
} from "../src/granola/transcript-diff.js";

describe("flattenTranscripts", () => {
  it("returns utterances keyed by document and utterance id", () => {
    const items = flattenTranscripts({
      docA: [{ id: "utt1", text: "hello" }],
    });

    expect(items).toEqual([
      {
        key: "docA:utt1",
        documentId: "docA",
        utterance: { id: "utt1", text: "hello" },
      },
    ]);
  });
});

describe("diffTranscriptState", () => {
  it("reports added and updated utterances", () => {
    const previous = {
      docA: [{ id: "utt1", text: "hel", is_final: false }],
    };
    const next = {
      docA: [
        { id: "utt1", text: "hello", is_final: true },
        { id: "utt2", text: "world", is_final: false },
      ],
    };

    const diff = diffTranscriptState(previous, next);

    expect(
      diff.updated.map((item) => ({
        key: item.key,
        text: item.utterance.text,
        previousText: item.previous.text,
      })),
    ).toEqual([{ key: "docA:utt1", text: "hello", previousText: "hel" }]);
    expect(
      diff.added.map((item) => ({ key: item.key, text: item.utterance.text })),
    ).toEqual([{ key: "docA:utt2", text: "world" }]);
  });
});
