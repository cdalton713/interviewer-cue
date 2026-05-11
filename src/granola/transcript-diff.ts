import type { GranolaTranscriptState, GranolaTranscriptUtterance } from "./types.js";

export interface FlattenedTranscriptUtterance {
  key: string;
  documentId: string;
  utterance: GranolaTranscriptUtterance;
}

export interface UpdatedTranscriptUtterance extends FlattenedTranscriptUtterance {
  previous: GranolaTranscriptUtterance;
}

export interface TranscriptStateDiff {
  added: FlattenedTranscriptUtterance[];
  updated: UpdatedTranscriptUtterance[];
}

export function flattenTranscripts(
  transcripts: GranolaTranscriptState | null | undefined,
): FlattenedTranscriptUtterance[] {
  return Object.entries(transcripts ?? {}).flatMap(([documentId, utterances]) => {
    if (!Array.isArray(utterances)) return [];
    return utterances
      .filter((utterance) => utterance?.id)
      .map((utterance) => ({
        key: `${documentId}:${utterance.id}`,
        documentId,
        utterance,
      }));
  });
}

export function diffTranscriptState(
  previousTranscripts: GranolaTranscriptState | null | undefined,
  nextTranscripts: GranolaTranscriptState | null | undefined,
): TranscriptStateDiff {
  const previous = buildIndex(previousTranscripts);
  const next = buildIndex(nextTranscripts);
  const added: FlattenedTranscriptUtterance[] = [];
  const updated: UpdatedTranscriptUtterance[] = [];

  for (const [key, item] of next) {
    const oldItem = previous.get(key);
    if (!oldItem) {
      added.push(item);
    } else if (hasChanged(oldItem.utterance, item.utterance)) {
      updated.push({ ...item, previous: oldItem.utterance });
    }
  }

  return { added, updated };
}

function buildIndex(
  transcripts: GranolaTranscriptState | null | undefined,
): Map<string, FlattenedTranscriptUtterance> {
  return new Map(flattenTranscripts(transcripts).map((item) => [item.key, item]));
}

function hasChanged(
  previous: GranolaTranscriptUtterance,
  next: GranolaTranscriptUtterance,
): boolean {
  return JSON.stringify(previous) !== JSON.stringify(next);
}
