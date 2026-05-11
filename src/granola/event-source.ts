import fs from "node:fs";
import path from "node:path";

import { readDek, readDecryptedCacheWithDek } from "./cache-reader.js";
import {
  diffTranscriptState,
  selectNewestTranscriptDocumentId,
  type TranscriptStateDiff,
} from "./transcript-diff.js";
import type { GranolaCacheFile, GranolaTranscriptState, WatchArgs } from "./types.js";

export interface NormalizedTranscriptDiff {
  added: Array<{
    key: string;
    documentId: string;
    utterance: TranscriptStateDiff["added"][number]["utterance"];
  }>;
  updated: Array<{
    key: string;
    documentId: string;
    utterance: TranscriptStateDiff["updated"][number]["utterance"];
    previous: TranscriptStateDiff["updated"][number]["previous"];
  }>;
}

export interface GranolaWatchStartedEvent {
  type: "watch_started";
  granolaDir: string;
  intervalMs: number;
  transcriptDocuments: number;
  activeDocumentId: string | null;
}

export interface GranolaTranscriptDiffEvent extends NormalizedTranscriptDiff {
  type: "transcript_diff";
  observedAt: string;
  activeDocumentId: string;
}

export interface GranolaWatchErrorEvent {
  type: "watch_error";
  message: string;
}

export interface GranolaWatchingEvent {
  type: "watching";
  activeDocumentId: string | null;
}

export interface GranolaEventSourceCallbacks {
  started?: (event: GranolaWatchStartedEvent) => void;
  transcriptDiff?: (event: GranolaTranscriptDiffEvent) => void;
  error?: (event: GranolaWatchErrorEvent) => void;
  watching?: (event: GranolaWatchingEvent) => void;
}

export interface GranolaEventSource {
  start(): void;
  stop(): void;
}

export interface GranolaEventSourceDependencies {
  readDek?: (args: WatchArgs) => Buffer;
  readCache?: (granolaDir: string, dek: Buffer) => GranolaCacheFile;
  getCacheMtimeMs?: (granolaDir: string) => number;
  setInterval?: (handler: () => void, intervalMs: number) => unknown;
  clearInterval?: (intervalId: unknown) => void;
  now?: () => Date;
}

export function createGranolaEventSource(
  args: WatchArgs,
  callbacks: GranolaEventSourceCallbacks,
  dependencies: GranolaEventSourceDependencies = {},
): GranolaEventSource {
  const deps = {
    readDek,
    readCache: readDecryptedCacheWithDek,
    getCacheMtimeMs,
    setInterval: (handler: () => void, intervalMs: number) =>
      setInterval(handler, intervalMs),
    clearInterval: (intervalId: unknown) =>
      clearInterval(intervalId as ReturnType<typeof setInterval>),
    now: () => new Date(),
    ...dependencies,
  };

  let dek: Buffer | null = null;
  let previousTranscripts: GranolaTranscriptState = {};
  let activeDocumentId: string | null = null;
  let lastMtime = 0;
  let intervalId: unknown;
  let running = false;
  let initialized = false;

  function initialize() {
    const nextDek = deps.readDek(args);
    const initialCache = deps.readCache(args.granolaDir, nextDek);
    const initialTranscripts = readTranscripts(initialCache);
    const nextActiveDocumentId = selectActiveDocumentId(initialTranscripts);
    const nextMtime = deps.getCacheMtimeMs(args.granolaDir);

    dek = nextDek;
    activeDocumentId = nextActiveDocumentId;
    previousTranscripts = args.changesOnly ? initialTranscripts : {};
    lastMtime = nextMtime;
    initialized = true;

    callbacks.started?.({
      type: "watch_started",
      granolaDir: args.granolaDir,
      intervalMs: args.intervalMs,
      transcriptDocuments: Object.keys(initialTranscripts).length,
      activeDocumentId,
    });

    emitActiveDiff(previousTranscripts, initialTranscripts);
    previousTranscripts = initialTranscripts;
  }

  function poll() {
    if (!initialized || !dek) {
      initialize();
      return;
    }

    const nextMtime = deps.getCacheMtimeMs(args.granolaDir);
    if (nextMtime <= lastMtime) return;

    const cache = deps.readCache(args.granolaDir, dek);
    const nextTranscripts = readTranscripts(cache);
    lastMtime = nextMtime;
    activeDocumentId = selectActiveDocumentId(nextTranscripts);
    emitActiveDiff(previousTranscripts, nextTranscripts);
    previousTranscripts = nextTranscripts;
    callbacks.watching?.({
      type: "watching",
      activeDocumentId,
    });
  }

  function emitActiveDiff(
    previous: GranolaTranscriptState,
    next: GranolaTranscriptState,
  ) {
    if (!activeDocumentId) return;

    const diff = diffTranscriptState(
      selectDocumentTranscripts(previous, activeDocumentId),
      selectDocumentTranscripts(next, activeDocumentId),
    );
    if (diff.added.length === 0 && diff.updated.length === 0) return;

    callbacks.transcriptDiff?.({
      type: "transcript_diff",
      observedAt: deps.now().toISOString(),
      activeDocumentId,
      ...normalizeDiff(diff),
    });
  }

  function selectActiveDocumentId(
    transcripts: GranolaTranscriptState,
  ): string | null {
    return args.transcriptDocumentId ?? selectNewestTranscriptDocumentId(transcripts);
  }

  function pollSafely() {
    try {
      poll();
    } catch (error) {
      callbacks.error?.({
        type: "watch_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      pollSafely();
      intervalId = deps.setInterval(pollSafely, args.intervalMs);
    },
    stop() {
      if (!running) return;
      running = false;
      dek = null;
      initialized = false;
      activeDocumentId = null;
      if (intervalId !== undefined) {
        deps.clearInterval(intervalId);
        intervalId = undefined;
      }
    },
  };
}

export function getCacheMtimeMs(granolaDir: string): number {
  return fs.statSync(path.join(granolaDir, "cache-v6.json.enc")).mtimeMs;
}

export function normalizeDiff(diff: TranscriptStateDiff): NormalizedTranscriptDiff {
  return {
    added: diff.added.map(({ key, documentId, utterance }) => ({
      key,
      documentId,
      utterance,
    })),
    updated: diff.updated.map(({ key, documentId, utterance, previous }) => ({
      key,
      documentId,
      utterance,
      previous,
    })),
  };
}

function readTranscripts(cache: GranolaCacheFile): GranolaTranscriptState {
  return cache.cache?.state?.transcripts ?? {};
}

function selectDocumentTranscripts(
  transcripts: GranolaTranscriptState,
  documentId: string,
): GranolaTranscriptState {
  return { [documentId]: transcripts[documentId] ?? [] };
}
