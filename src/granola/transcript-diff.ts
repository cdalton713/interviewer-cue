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

export function selectNewestTranscriptDocumentId(
  transcripts: GranolaTranscriptState | null | undefined,
): string | null {
  let best:
    | {
        documentId: string;
        timestamp: number | null;
        order: number;
      }
    | null = null;
  let order = 0;

  for (const [documentId, utterances] of Object.entries(transcripts ?? {})) {
    if (!Array.isArray(utterances)) continue;
    for (const utterance of utterances) {
      order += 1;
      const candidate = {
        documentId,
        timestamp:
          parseTranscriptTimestamp(utterance?.end_timestamp) ??
          parseTranscriptTimestamp(utterance?.start_timestamp),
        order,
      };
      if (!best || isNewerTranscriptCandidate(candidate, best)) {
        best = candidate;
      }
    }
  }

  return best?.documentId ?? null;
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

function parseTranscriptTimestamp(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isNewerTranscriptCandidate(
  candidate: { timestamp: number | null; order: number },
  current: { timestamp: number | null; order: number },
): boolean {
  if (candidate.timestamp !== null && current.timestamp !== null) {
    return candidate.timestamp > current.timestamp ||
      (candidate.timestamp === current.timestamp && candidate.order > current.order);
  }
  if (candidate.timestamp !== null) return true;
  if (current.timestamp !== null) return false;
  return candidate.order > current.order;
}
