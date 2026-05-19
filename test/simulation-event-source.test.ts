import net from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GranolaEventSourceCallbacks } from "../src/granola/event-source.js";
import { createSimulationClientEventSource } from "../src/simulation/client-event-source.js";
import { parseTcpUrl } from "../src/simulation/protocol.js";
import { createSimulationTranscriptServer } from "../src/simulation/server.js";

describe("simulation transcript client/server", () => {
  const servers: Array<{ stop: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.stop()));
    servers.length = 0;
  });

  it("emits watch_started on client connect and transcript_diff on manual advance", async () => {
    const server = createSimulationTranscriptServer({
      scenario: parseDemoScenario(),
      host: "127.0.0.1",
      port: 0,
      now: () => new Date("2026-05-11T12:00:00.000Z"),
    });
    servers.push(server);
    await server.start();

    const callbacks = createCallbacks();
    const source = createSimulationClientEventSource(server.url, callbacks);
    source.start();
    await waitFor(() => expect(callbacks.started).toHaveBeenCalledOnce());

    await server.advance();
    await waitFor(() => expect(callbacks.transcriptDiff).toHaveBeenCalledOnce());

    expect(callbacks.started).toHaveBeenCalledWith({
      type: "watch_started",
      granolaDir: "granola-replay://sim-demo",
      intervalMs: 0,
      transcriptDocuments: 1,
      activeDocumentId: "sim-demo",
    });
    expect(callbacks.transcriptDiff.mock.calls[0]?.[0]).toMatchObject({
      type: "transcript_diff",
      observedAt: "2026-05-11T12:00:00.000Z",
      activeDocumentId: "sim-demo",
      added: [
        {
          key: "sim-demo:sim-demo-0000-1",
          documentId: "sim-demo",
          utterance: {
            source: "Interviewer",
            text: "Tell me about the queueing design.",
          },
        },
      ],
      updated: [],
    });

    source.stop();
  });

  it("replays current transcript state when a client reconnects after hunks emitted", async () => {
    const server = createSimulationTranscriptServer({
      scenario: parseDemoScenario(),
      host: "127.0.0.1",
      port: 0,
      now: () => new Date("2026-05-11T12:00:00.000Z"),
    });
    servers.push(server);
    await server.start();
    await server.advance();

    const callbacks = createCallbacks();
    const source = createSimulationClientEventSource(server.url, callbacks);
    source.start();
    await waitFor(() => expect(callbacks.transcriptDiff).toHaveBeenCalledOnce());

    expect(callbacks.transcriptDiff.mock.calls[0]?.[0].added).toMatchObject([
      {
        key: "sim-demo:sim-demo-0000-1",
        utterance: { text: "Tell me about the queueing design." },
      },
    ]);
    source.stop();
  });

  it("maps malformed NDJSON into watch_error callbacks", async () => {
    const rawServer = net.createServer((socket) => {
      socket.write("{not json}\n");
    });
    await new Promise<void>((resolve) => rawServer.listen(0, "127.0.0.1", resolve));
    const address = rawServer.address();
    if (!address || typeof address === "string") {
      throw new Error("expected tcp address");
    }

    const callbacks = createCallbacks();
    const source = createSimulationClientEventSource(
      `tcp://127.0.0.1:${address.port}`,
      callbacks,
    );
    source.start();
    await waitFor(() => expect(callbacks.error).toHaveBeenCalledOnce());

    expect(callbacks.error.mock.calls[0]?.[0]).toMatchObject({
      type: "watch_error",
      message: expect.stringContaining("Malformed simulation event"),
    });

    source.stop();
    await new Promise<void>((resolve) => rawServer.close(() => resolve()));
  });

  it("parses TCP URLs for localhost sidecar connections", () => {
    expect(parseTcpUrl("tcp://127.0.0.1:4767")).toEqual({
      host: "127.0.0.1",
      port: 4767,
    });
    expect(() => parseTcpUrl("http://127.0.0.1:4767")).toThrow(/tcp url/i);
  });
});

function parseDemoScenario() {
  return {
    title: "Demo",
    documentId: "sim-demo",
    hunks: [
      {
        label: "00:00",
        startSeconds: 0,
        utterances: [
          {
            id: "sim-demo-0000-1",
            source: "Interviewer",
            text: "Tell me about the queueing design.",
            start_timestamp: "0",
            end_timestamp: "0",
            is_final: true,
          },
        ],
      },
      {
        label: "00:30",
        startSeconds: 30,
        utterances: [
          {
            id: "sim-demo-0030-1",
            source: "Candidate",
            text: "We introduced a durable queue.",
            start_timestamp: "30",
            end_timestamp: "30",
            is_final: true,
          },
        ],
      },
    ],
  };
}

function createCallbacks() {
  return {
    started: vi.fn(),
    transcriptDiff: vi.fn(),
    error: vi.fn(),
    watching: vi.fn(),
  } satisfies Required<GranolaEventSourceCallbacks>;
}

async function waitFor(assertion: () => void, timeoutMs = 1000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError;
}
