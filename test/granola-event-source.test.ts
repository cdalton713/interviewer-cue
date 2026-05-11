import { describe, expect, it, vi } from "vitest";

import {
  createGranolaEventSource,
  type GranolaEventSourceCallbacks,
  type GranolaEventSourceDependencies,
} from "../src/granola/event-source.js";
import type { GranolaCacheFile, WatchArgs } from "../src/granola/types.js";

describe("createGranolaEventSource", () => {
  it("selects the newest transcript document on startup and preloads it by default", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "older", end_timestamp: "10" }],
        docB: [{ id: "utt2", text: "current", end_timestamp: "20" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(baseArgs(), callbacks, deps);

    source.start();

    expect(callbacks.started).toHaveBeenCalledWith({
      type: "watch_started",
      granolaDir: "/granola",
      intervalMs: 1000,
      transcriptDocuments: 2,
      activeDocumentId: "docB",
    });
    expect(callbacks.transcriptDiff).toHaveBeenCalledOnce();
    expect(callbacks.transcriptDiff.mock.calls[0]?.[0]).toMatchObject({
      type: "transcript_diff",
      activeDocumentId: "docB",
      added: [
        {
          key: "docB:utt2",
          documentId: "docB",
          utterance: { text: "current" },
        },
      ],
    });
  });

  it("honors an explicit transcript document id", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "chosen", end_timestamp: "10" }],
        docB: [{ id: "utt2", text: "newest", end_timestamp: "20" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(
      { ...baseArgs(), transcriptDocumentId: "docA" },
      callbacks,
      deps,
    );

    source.start();

    expect(callbacks.started.mock.calls[0]?.[0].activeDocumentId).toBe("docA");
    expect(callbacks.transcriptDiff.mock.calls[0]?.[0].added).toMatchObject([
      { key: "docA:utt1", documentId: "docA", utterance: { text: "chosen" } },
    ]);
  });

  it("emits only future changes with changes-only mode", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "already here", end_timestamp: "10" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(
      { ...baseArgs(), changesOnly: true },
      callbacks,
      deps,
    );

    source.start();
    expect(callbacks.transcriptDiff).not.toHaveBeenCalled();

    deps.setCache(
      transcriptCache({
        docA: [
          { id: "utt1", text: "already here", end_timestamp: "10" },
          { id: "utt2", text: "new words", end_timestamp: "11" },
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
      activeDocumentId: "docA",
    });
    expect(callbacks.transcriptDiff).toHaveBeenCalledOnce();
    expect(callbacks.transcriptDiff.mock.calls[0]?.[0]).toMatchObject({
      activeDocumentId: "docA",
      added: [
        {
          key: "docA:utt2",
          documentId: "docA",
          utterance: { text: "new words" },
        },
      ],
    });
  });

  it("ignores older documents while the current document stays active", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "older", end_timestamp: "10" }],
        docB: [{ id: "utt2", text: "current", end_timestamp: "20" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(
      { ...baseArgs(), changesOnly: true },
      callbacks,
      deps,
    );

    source.start();
    deps.setCache(
      transcriptCache({
        docA: [
          { id: "utt1", text: "older", end_timestamp: "10" },
          { id: "utt3", text: "still older", end_timestamp: "15" },
        ],
        docB: [{ id: "utt2", text: "current", end_timestamp: "20" }],
      }),
      11,
    );
    deps.tick();

    expect(callbacks.transcriptDiff).not.toHaveBeenCalled();
  });

  it("switches focus when another document receives newer live utterances", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "current", end_timestamp: "20" }],
        docB: [{ id: "utt2", text: "older", end_timestamp: "10" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(
      { ...baseArgs(), changesOnly: true },
      callbacks,
      deps,
    );

    source.start();
    deps.setCache(
      transcriptCache({
        docA: [{ id: "utt1", text: "current", end_timestamp: "20" }],
        docB: [
          { id: "utt2", text: "older", end_timestamp: "10" },
          { id: "utt3", text: "new meeting", end_timestamp: "30" },
        ],
      }),
      11,
    );
    deps.tick();

    expect(callbacks.transcriptDiff).toHaveBeenCalledOnce();
    expect(callbacks.transcriptDiff.mock.calls[0]?.[0]).toMatchObject({
      activeDocumentId: "docB",
      added: [
        { key: "docB:utt3", documentId: "docB", utterance: { text: "new meeting" } },
      ],
    });
  });

  it("keeps stable updates for partial utterances", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "hel", is_final: false, end_timestamp: "10" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(
      { ...baseArgs(), changesOnly: true },
      callbacks,
      deps,
    );

    source.start();
    deps.setCache(
      transcriptCache({
        docA: [{ id: "utt1", text: "hello", is_final: true, end_timestamp: "11" }],
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

  it("recovers after an initial read/decrypt error", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "available after retry" }],
      }),
      initialMtime: 10,
    });
    deps.readCache.mockImplementationOnce(() => {
      throw new Error("decrypt failed");
    });
    const source = createGranolaEventSource(baseArgs(), callbacks, deps);

    source.start();
    expect(callbacks.error).toHaveBeenCalledWith({
      type: "watch_error",
      message: "decrypt failed",
    });

    deps.tick();

    expect(callbacks.started).toHaveBeenCalledOnce();
    expect(callbacks.transcriptDiff).toHaveBeenCalledOnce();
  });

  it("reports a successful poll after a read/decrypt error even without transcript changes", () => {
    const callbacks = createCallbacks();
    const deps = createFakeDependencies({
      initialCache: transcriptCache({
        docA: [{ id: "utt1", text: "stable", end_timestamp: "10" }],
      }),
      initialMtime: 10,
    });
    const source = createGranolaEventSource(
      { ...baseArgs(), changesOnly: true },
      callbacks,
      deps,
    );

    source.start();
    deps.readCache.mockImplementationOnce(() => {
      throw new Error("decrypt failed");
    });
    deps.setCache(
      transcriptCache({
        docA: [{ id: "utt1", text: "stable", end_timestamp: "10" }],
      }),
      11,
    );
    deps.tick();
    expect(callbacks.error).toHaveBeenCalledWith({
      type: "watch_error",
      message: "decrypt failed",
    });

    deps.setCache(
      transcriptCache({
        docA: [{ id: "utt1", text: "stable", end_timestamp: "10" }],
      }),
      12,
    );
    deps.tick();

    expect(callbacks.watching).toHaveBeenCalledWith({
      type: "watching",
      activeDocumentId: "docA",
    });
    expect(callbacks.transcriptDiff).not.toHaveBeenCalled();
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
    watching: vi.fn(),
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
    changesOnly: false,
    json: false,
    summary: true,
    transcriptDocumentId: null,
    keychainService: "Granola",
    keychainAccount: "Granola",
    help: false,
  };
}
