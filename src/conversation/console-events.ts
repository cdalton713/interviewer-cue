import type {
  GranolaTranscriptDiffEvent,
  GranolaWatchErrorEvent,
  GranolaWatchStartedEvent,
} from "../granola/event-source.js";
import type {
  ConsoleEvent,
  ErrorConsoleEvent,
  SystemConsoleEvent,
  TranscriptConsoleEvent,
} from "./types.js";

export function mapTranscriptDiffToConsoleEvents(
  event: GranolaTranscriptDiffEvent,
): TranscriptConsoleEvent[] {
  return [...event.added, ...event.updated].map((item) => {
    const utteranceId = item.utterance.id ?? item.key.split(":").at(-1) ?? item.key;
    return {
      type: "transcript",
      id: item.key,
      documentId: item.documentId,
      utteranceId,
      text: item.utterance.text ?? "",
      speaker: item.utterance.source,
      observedAt: event.observedAt,
      startTimestamp: item.utterance.start_timestamp,
      endTimestamp: item.utterance.end_timestamp,
      isFinal: item.utterance.is_final,
    };
  });
}

export function mapWatchStartedToConsoleEvent(
  event: GranolaWatchStartedEvent,
): SystemConsoleEvent {
  return {
    type: "system",
    id: "watch-started",
    message: `Watching ${event.granolaDir} every ${event.intervalMs}ms. Baseline documents: ${event.transcriptDocuments}.`,
  };
}

export function mapWatchErrorToConsoleEvent(
  event: GranolaWatchErrorEvent,
): ErrorConsoleEvent {
  return {
    type: "error",
    id: "watch-error",
    message: event.message,
  };
}

export function mergeConsoleEvents(
  currentEvents: ConsoleEvent[],
  nextEvents: ConsoleEvent[],
): ConsoleEvent[] {
  const merged = [...currentEvents];
  for (const event of nextEvents) {
    const existingIndex = merged.findIndex(
      (current) => current.type === event.type && current.id === event.id,
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = event;
    } else {
      merged.push(event);
    }
  }
  return merged;
}
