import { describe, expect, it, vi } from "vitest";

import {
  createGranolaEventSource,
  type GranolaEventSourceCallbacks,
  type GranolaEventSourceDependencies,
} from "../src/granola/event-source.js";
import type { GranolaCacheFile, WatchArgs } from "../src/granola/types.js";

describe("createGranolaEventSource", () => {
  it("baselines the current cache on startup and emits only new changes", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "already here" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(baseArgs(), callbacks, deps);

    source.start();
    deps.setCache(
      transcriptCache({
        docA: [
          { id: "utt1", text: "already here" },
          { id: "utt2", text: "new words" },
        ],
      }),
      11,
    );
    deps.tick();

    expect(callbacks.started).toHaveBeenCalledWith({
      type: "watch_started",
      granolaDir: "/granola",
      intervalMs: 1000,
      transcriptDocuments: 1,
    });
    expect(callbacks.transcriptDiff).toHaveBeenCalledOnce();
    expect(callbacks.transcriptDiff.mock.calls[0]?.[0].added).toMatchObject([
      { key: "docA:utt2", documentId: "docA", utterance: { text: "new words" } },
    ]);
  });

  it("emits updates for changed utterances", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "hel", is_final: false }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(baseArgs(), callbacks, deps);

    source.start();
    deps.setCache(
      transcriptCache({
        docA: [{ id: "utt1", text: "hello", is_final: true }],
      }),
      11,
    );
    deps.tick();

    expect(callbacks.transcriptDiff).toHaveBeenCalledOnce();
    expect(callbacks.transcriptDiff.mock.calls[0]?.[0].updated).toMatchObject([
      {
        key: "docA:utt1",
        documentId: "docA",
        utterance: { text: "hello", is_final: true },
        previous: { text: "hel", is_final: false },
      },
    ]);
  });

  it("can emit existing transcript entries for CLI/debug usage", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "already here" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(
      { ...baseArgs(), emitExisting: true },
      callbacks,
      deps,
    );

    source.start();

    expect(callbacks.transcriptDiff).toHaveBeenCalledOnce();
    expect(callbacks.transcriptDiff.mock.calls[0]?.[0].added).toMatchObject([
      { key: "docA:utt1", documentId: "docA", utterance: { text: "already here" } },
    ]);
  });

  it("stops polling cleanly", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({}),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(baseArgs(), callbacks, deps);

    source.start();
    source.stop();
    deps.setCache(transcriptCache({ docA: [{ id: "utt1", text: "ignored" }] }), 11);
    deps.tick();

    expect(deps.clearInterval).toHaveBeenCalledOnce();
    expect(callbacks.transcriptDiff).not.toHaveBeenCalled();
  });

  it("reports read and decrypt errors without crashing", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({}),
      initialMtime: 10,
    });
    deps.readCache.mockImplementationOnce(() => {
      throw new Error("decrypt failed");
    });
    const source = createGranolaEventSource(baseArgs(), callbacks, deps);

    expect(() => source.start()).not.toThrow();

    expect(callbacks.error).toHaveBeenCalledWith({
      type: "watch_error",
      message: "decrypt failed",
    });
  });
});

function createCallbacks() {
  return {
    started: vi.fn(),
    transcriptDiff: vi.fn(),
    error: vi.fn(),
  } satisfies Required<GranolaEventSourceCallbacks>;
}

function createFakeDependencies({
  initialCache,
  initialMtime,
}: {
  initialCache: GranolaCacheFile;
  initialMtime: number;
}) {
  let cache = initialCache;
  let mtime = initialMtime;
  let intervalHandler: (() => void) | null = null;
  let stopped = false;

  return {
    readDek: vi.fn(() => Buffer.from("dek")),
    readCache: vi.fn(() => cache),
    getCacheMtimeMs: vi.fn(() => mtime),
    setInterval: vi.fn((handler: () => void) => {
      intervalHandler = handler;
      stopped = false;
      return 1;
    }),
    clearInterval: vi.fn(() => {
      stopped = true;
    }),
    now: vi.fn(() => new Date("2026-05-11T12:00:00.000Z")),
    setCache(nextCache: GranolaCacheFile, nextMtime: number) {
      cache = nextCache;
      mtime = nextMtime;
    },
    tick() {
      if (!stopped) intervalHandler?.();
    },
  } satisfies GranolaEventSourceDependencies & {
    readCache: ReturnType<typeof vi.fn<() => GranolaCacheFile>>;
    clearInterval: ReturnType<typeof vi.fn>;
    setCache(nextCache: GranolaCacheFile, nextMtime: number): void;
    tick(): void;
  };
}

function transcriptCache(
  transcripts: NonNullable<GranolaCacheFile["cache"]>["state"] extends infer State
    ? State extends { transcripts?: infer Transcripts }
      ? Transcripts
      : never
    : never,
): GranolaCacheFile {
  return {
    cache: {
      state: {
        transcripts,
      },
    },
  };
}

function baseArgs(): WatchArgs {
  return {
    granolaDir: "/granola",
    intervalMs: 1000,
    emitExisting: false,
    json: false,
    summary: true,
    transcriptDocumentId: null,
    keychainService: "Granola",
    keychainAccount: "Granola",
    help: false,
  };
}
