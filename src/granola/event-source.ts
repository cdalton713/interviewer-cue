import fs from "node:fs";
import path from "node:path";

import { readDek, readDecryptedCacheWithDek } from "./cache-reader.js";
import { diffTranscriptState, type TranscriptStateDiff } from "./transcript-diff.js";
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
}

export interface GranolaTranscriptDiffEvent extends NormalizedTranscriptDiff {
  type: "transcript_diff";
  observedAt: string;
}

export interface GranolaWatchErrorEvent {
  type: "watch_error";
  message: string;
}

export interface GranolaEventSourceCallbacks {
  started?: (event: GranolaWatchStartedEvent) => void;
  transcriptDiff?: (event: GranolaTranscriptDiffEvent) => void;
  error?: (event: GranolaWatchErrorEvent) => void;
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
  let lastMtime = 0;
  let intervalId: unknown;
  let running = false;

  function initialize() {
    dek = deps.readDek(args);
    const initialCache = deps.readCache(args.granolaDir, dek);
    const initialTranscripts = readTranscripts(initialCache);
    previousTranscripts = args.emitExisting ? {} : initialTranscripts;
    lastMtime = deps.getCacheMtimeMs(args.granolaDir);

    callbacks.started?.({
      type: "watch_started",
      granolaDir: args.granolaDir,
      intervalMs: args.intervalMs,
      transcriptDocuments: Object.keys(initialTranscripts).length,
    });

    if (args.emitExisting) {
      emitDiff(previousTranscripts, initialTranscripts);
      previousTranscripts = initialTranscripts;
    }
  }

  function poll() {
    if (!dek) {
      initialize();
      return;
    }

    const nextMtime = deps.getCacheMtimeMs(args.granolaDir);
    if (nextMtime <= lastMtime) return;

    const cache = deps.readCache(args.granolaDir, dek);
    const nextTranscripts = readTranscripts(cache);
    lastMtime = nextMtime;
    emitDiff(previousTranscripts, nextTranscripts);
    previousTranscripts = nextTranscripts;
  }

  function emitDiff(
    previous: GranolaTranscriptState,
    next: GranolaTranscriptState,
  ) {
    const diff = diffTranscriptState(previous, next);
    if (diff.added.length === 0 && diff.updated.length === 0) return;

    callbacks.transcriptDiff?.({
      type: "transcript_diff",
      observedAt: deps.now().toISOString(),
      ...normalizeDiff(diff),
    });
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
