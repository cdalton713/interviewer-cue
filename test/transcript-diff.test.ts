import { describe, expect, it } from "vitest";

import {
  diffTranscriptState,
  flattenTranscripts,
  selectNewestTranscriptDocumentId,
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

describe("selectNewestTranscriptDocumentId", () => {
  it("selects the document with the newest utterance timestamp", () => {
    expect(
      selectNewestTranscriptDocumentId({
        docA: [{ id: "utt1", text: "older", end_timestamp: "10" }],
        docB: [{ id: "utt2", text: "newer", end_timestamp: "20" }],
      }),
    ).toBe("docB");
  });

  it("falls back from end timestamp to start timestamp and stored order", () => {
    expect(
      selectNewestTranscriptDocumentId({
        docA: [{ id: "utt1", text: "no timestamp" }],
        docB: [{ id: "utt2", text: "has start", start_timestamp: "10" }],
      }),
    ).toBe("docB");

    expect(
      selectNewestTranscriptDocumentId({
        docA: [{ id: "utt1", text: "first" }],
        docB: [{ id: "utt2", text: "second" }],
      }),
    ).toBe("docB");
  });

  it("returns null when no transcript document has utterances", () => {
    expect(selectNewestTranscriptDocumentId({ docA: [] })).toBeNull();
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
