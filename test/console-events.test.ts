import { describe, expect, it } from "vitest";

import {
  mapTranscriptDiffToConsoleEvents,
  mapWatchErrorToConsoleEvent,
  mapWatchStartedToConsoleEvent,
} from "../src/conversation/console-events.js";

describe("mapTranscriptDiffToConsoleEvents", () => {
  it("maps added and updated Granola utterances to stable transcript console events", () => {
    const events = mapTranscriptDiffToConsoleEvents({
      type: "transcript_diff",
      observedAt: "2026-05-11T12:00:00.000Z",
      activeDocumentId: "docA",
      added: [
        {
          key: "docA:utt1",
          documentId: "docA",
          utterance: {
            id: "utt1",
            text: "First pass",
            source: "person",
            start_timestamp: "10",
            end_timestamp: "11",
            is_final: false,
          },
        },
      ],
      updated: [
        {
          key: "docA:utt2",
          documentId: "docA",
          utterance: {
            id: "utt2",
            text: "Final pass",
            source: "microphone",
            is_final: true,
          },
          previous: { id: "utt2", text: "Final pa" },
        },
      ],
    });

    expect(events).toEqual([
      {
        type: "transcript",
        id: "docA:utt1",
        documentId: "docA",
        utteranceId: "utt1",
        text: "First pass",
        speaker: "person",
        observedAt: "2026-05-11T12:00:00.000Z",
        startTimestamp: "10",
        endTimestamp: "11",
        isFinal: false,
      },
      {
        type: "transcript",
        id: "docA:utt2",
        documentId: "docA",
        utteranceId: "utt2",
        text: "Final pass",
        speaker: "microphone",
        observedAt: "2026-05-11T12:00:00.000Z",
        startTimestamp: undefined,
        endTimestamp: undefined,
        isFinal: true,
      },
    ]);
  });
});

describe("watch status console event mappers", () => {
  it("maps watch startup and failures to system console events", () => {
    expect(
      mapWatchStartedToConsoleEvent({
        type: "watch_started",
        granolaDir: "/granola",
        intervalMs: 2000,
        transcriptDocuments: 3,
        activeDocumentId: "docA",
      }),
    ).toEqual({
      type: "system",
      id: "watch-started",
      message:
        "Watching /granola every 2000ms. Baseline documents: 3. Active document: docA.",
    });

    expect(
      mapWatchErrorToConsoleEvent({
        type: "watch_error",
        message: "decrypt failed",
      }),
    ).toEqual({
      type: "error",
      id: "watch-error",
      message: "decrypt failed",
    });
  });
});
