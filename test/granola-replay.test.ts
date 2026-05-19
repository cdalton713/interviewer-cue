import { describe, expect, it } from "vitest";

import {
  createGranolaReplayScenario,
  listRecentGranolaTranscriptDocuments,
} from "../src/simulation/granola-replay.js";
import type { GranolaCacheFile } from "../src/granola/types.js";

describe("createGranolaReplayScenario", () => {
  it("groups prior Granola utterances into transcript-time replay steps", () => {
    const scenario = createGranolaReplayScenario(granolaCache(), {
      documentId: "docA",
      stepSeconds: 30,
    });

    expect(scenario).toEqual({
      title: "Granola transcript docA",
      documentId: "docA",
      hunks: [
        {
          label: "00:00",
          startSeconds: 0,
          utterances: [
            expect.objectContaining({
              id: "utt1",
              text: "Intro question.",
              start_timestamp: "5",
              end_timestamp: "5",
            }),
            expect.objectContaining({
              id: "utt2",
              text: "Candidate answer.",
              start_timestamp: "25",
              end_timestamp: "25",
            }),
          ],
        },
        {
          label: "01:00",
          startSeconds: 60,
          utterances: [
            expect.objectContaining({
              id: "utt3",
              text: "More detail.",
              start_timestamp: "61",
              end_timestamp: "61",
            }),
          ],
        },
      ],
    });
  });

  it("selects the newest transcript document when no document id is provided", () => {
    const scenario = createGranolaReplayScenario(granolaCache(), {
      documentId: null,
      stepSeconds: 30,
    });

    expect(scenario.documentId).toBe("docB");
    expect(scenario.hunks[0]?.utterances[0]?.id).toBe("newest");
  });

  it("rejects an empty or missing Granola transcript", () => {
    expect(() =>
      createGranolaReplayScenario(granolaCache(), {
        documentId: "missing",
        stepSeconds: 30,
      }),
    ).toThrow(/No Granola transcript found/);
  });

  it("lists recent Granola transcript documents for interactive selection", () => {
    expect(listRecentGranolaTranscriptDocuments(granolaCache(), { limit: 2 })).toEqual([
      {
        documentId: "docB",
        utterances: 1,
        latestTimestamp: "120",
        latestSeconds: 120,
        latestSource: "candidate",
        latestTextPreview: "Newest transcript.",
      },
      {
        documentId: "docA",
        utterances: 3,
        latestTimestamp: "61",
        latestSeconds: 61,
        latestSource: "candidate",
        latestTextPreview: "More detail.",
      },
    ]);
  });
});

function granolaCache(): GranolaCacheFile {
  return {
    cache: {
      state: {
        transcripts: {
          docA: [
            {
              id: "utt2",
              text: "Candidate answer.",
              source: "candidate",
              start_timestamp: "25",
              end_timestamp: "25",
              is_final: true,
            },
            {
              id: "utt1",
              text: "Intro question.",
              source: "microphone",
              start_timestamp: "5",
              end_timestamp: "5",
              is_final: true,
            },
            {
              id: "utt3",
              text: "More detail.",
              source: "candidate",
              start_timestamp: "61",
              end_timestamp: "61",
              is_final: true,
            },
          ],
          docB: [
            {
              id: "newest",
              text: "Newest transcript.",
              source: "candidate",
              start_timestamp: "120",
              end_timestamp: "120",
              is_final: true,
            },
          ],
        },
      },
    },
  };
}
