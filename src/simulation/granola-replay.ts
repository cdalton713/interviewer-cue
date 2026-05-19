import type { GranolaCacheFile, GranolaTranscriptUtterance } from "../granola/types.js";
import type { SimulationScenario, SimulationScenarioHunk } from "./replay-scenario.js";

export interface GranolaReplayOptions {
  documentId: string | null;
  stepSeconds: number;
}

export interface RecentGranolaTranscriptDocument {
  documentId: string;
  utterances: number;
  latestTimestamp: string | undefined;
  latestSeconds: number | null;
  latestSource: string | undefined;
  latestTextPreview: string;
}

export function createGranolaReplayScenario(
  cacheFile: GranolaCacheFile,
  options: GranolaReplayOptions,
): SimulationScenario {
  const transcripts = cacheFile.cache?.state?.transcripts ?? {};
  const documentId =
    options.documentId ?? listRecentGranolaTranscriptDocuments(cacheFile, { limit: 1 })[0]?.documentId;
  const utterances = documentId ? transcripts[documentId] : undefined;

  if (!documentId || !Array.isArray(utterances) || utterances.length === 0) {
    throw new Error(
      `No Granola transcript found${options.documentId ? ` for ${options.documentId}` : ""}`,
    );
  }

  const hunks = groupUtterancesByStep(
    utterances.filter((utterance) => utterance.id),
    options.stepSeconds,
  );
  if (hunks.length === 0) {
    throw new Error(`No Granola transcript found for ${documentId}`);
  }

  return {
    title: `Granola transcript ${documentId}`,
    documentId,
    hunks,
  };
}

export function listRecentGranolaTranscriptDocuments(
  cacheFile: GranolaCacheFile,
  options: { limit?: number } = {},
): RecentGranolaTranscriptDocument[] {
  const limit = options.limit ?? 10;
  const transcripts = cacheFile.cache?.state?.transcripts ?? {};
  return Object.entries(transcripts)
    .flatMap(([documentId, utterances]) => {
      if (!Array.isArray(utterances) || utterances.length === 0) return [];
      const sorted = sortUtterancesByTranscriptTime(utterances);
      const latest = sorted.at(-1);
      if (!latest) return [];
      const latestTimestamp = getTranscriptTimestamp(latest);
      return [
        {
          documentId,
          utterances: utterances.length,
          latestTimestamp,
          latestSeconds: parseTranscriptSeconds(latestTimestamp),
          latestSource: latest.source,
          latestTextPreview: previewText(latest.text),
        },
      ];
    })
    .sort((left, right) => {
      if (left.latestSeconds !== null && right.latestSeconds !== null) {
        return right.latestSeconds - left.latestSeconds;
      }
      if (left.latestSeconds !== null) return -1;
      if (right.latestSeconds !== null) return 1;
      return right.documentId.localeCompare(left.documentId);
    })
    .slice(0, limit);
}

function groupUtterancesByStep(
  utterances: GranolaTranscriptUtterance[],
  stepSeconds: number,
): SimulationScenarioHunk[] {
  const buckets = new Map<number, GranolaTranscriptUtterance[]>();

  for (const utterance of sortUtterancesByTranscriptTime(utterances)) {
    const seconds = parseTranscriptSeconds(getTranscriptTimestamp(utterance)) ?? 0;
    const bucketStart = Math.floor(seconds / stepSeconds) * stepSeconds;
    const bucket = buckets.get(bucketStart) ?? [];
    bucket.push(utterance);
    buckets.set(bucketStart, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([startSeconds, bucket]) => ({
      label: formatReplayTimestamp(startSeconds),
      startSeconds,
      utterances: bucket,
    }));
}

function sortUtterancesByTranscriptTime(
  utterances: GranolaTranscriptUtterance[],
): GranolaTranscriptUtterance[] {
  return utterances
    .map((utterance, index) => ({ utterance, index }))
    .sort((left, right) => {
      const leftSeconds = parseTranscriptSeconds(getTranscriptTimestamp(left.utterance));
      const rightSeconds = parseTranscriptSeconds(getTranscriptTimestamp(right.utterance));
      if (leftSeconds !== null && rightSeconds !== null) {
        return leftSeconds - rightSeconds || left.index - right.index;
      }
      if (leftSeconds !== null) return -1;
      if (rightSeconds !== null) return 1;
      return left.index - right.index;
    })
    .map(({ utterance }) => utterance);
}

function getTranscriptTimestamp(
  utterance: GranolaTranscriptUtterance,
): string | undefined {
  return utterance.end_timestamp ?? utterance.start_timestamp;
}

function parseTranscriptSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed / 1000 : null;
}

function formatReplayTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${mmss}` : mmss;
}

function previewText(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}
