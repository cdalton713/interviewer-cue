import { describe, expect, it } from "vitest";

import type { TranscriptConsoleEvent } from "../src/conversation/types.js";
import {
  buildLiveGenerationPromptTranscriptText,
  isLiveGenerationTranscriptEvent,
} from "../src/ui/chat-app-helpers.js";

describe("live generation transcript helpers", () => {
  it("keeps only the newest eligible utterances", () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      transcriptEvent(`utt${index + 1}`, `Answer ${index + 1}`),
    );

    expect(
      buildLiveGenerationPromptTranscriptText(events, { maxUtterances: 3 }),
    ).toBe(["Answer 3", "Answer 4", "Answer 5"].join("\n"));
  });

  it("excludes microphone utterances and non-final utterances", () => {
    const events = [
      transcriptEvent("candidate-1", "Final candidate answer"),
      transcriptEvent("microphone", "Interviewer prompt", {
        speaker: " MicroPhone ",
      }),
      transcriptEvent("draft", "Partial candidate answer", { isFinal: false }),
      transcriptEvent("implicit-final", "Implicit final answer", {
        isFinal: undefined,
      }),
    ];

    expect(events.filter(isLiveGenerationTranscriptEvent).map((event) => event.text)).toEqual([
      "Final candidate answer",
      "Implicit final answer",
    ]);
    expect(buildLiveGenerationPromptTranscriptText(events)).toBe(
      ["Final candidate answer", "Implicit final answer"].join("\n"),
    );
  });

  it("enforces maxChars by keeping newest trailing text", () => {
    const events = [
      transcriptEvent("old", "old answer"),
      transcriptEvent("middle", "middle answer"),
      transcriptEvent("new", "newest answer with enough detail"),
    ];

    expect(buildLiveGenerationPromptTranscriptText(events, { maxChars: 20 })).toBe(
      "r with enough detail",
    );
  });
});

function transcriptEvent(
  utteranceId: string,
  text: string,
  overrides: Partial<TranscriptConsoleEvent> = {},
): TranscriptConsoleEvent {
  return {
    type: "transcript",
    id: `docA:${utteranceId}`,
    documentId: "docA",
    utteranceId,
    text,
    speaker: "candidate",
    observedAt: "2026-05-11T12:00:00.000Z",
    isFinal: true,
    ...overrides,
  };
}
