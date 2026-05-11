import net from "node:net";

import type {
  GranolaTranscriptDiffEvent,
  GranolaWatchStartedEvent,
} from "../granola/event-source.js";
import type { GranolaTranscriptUtterance } from "../granola/types.js";
import { encodeSimulationEvent } from "./protocol.js";
import type { SimulationScenario } from "./scenario.js";

export interface SimulationTranscriptServer {
  readonly url: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  advance(): Promise<GranolaTranscriptDiffEvent | null>;
}

export interface SimulationTranscriptServerOptions {
  scenario: SimulationScenario;
  host?: string;
  port?: number;
  now?: () => Date;
}

export function createSimulationTranscriptServer({
  scenario,
  host = "127.0.0.1",
  port = 4767,
  now = () => new Date(),
}: SimulationTranscriptServerOptions): SimulationTranscriptServer {
  const sockets = new Set<net.Socket>();
  const transcriptState = new Map<string, GranolaTranscriptUtterance>();
  const transcriptOrder: string[] = [];
  let emittedHunks = 0;
  let actualPort = port;

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => sockets.delete(socket));

    writeEvent(socket, createWatchStartedEvent(scenario));
    const replay = createReplayEvent();
    if (replay) writeEvent(socket, replay);
  });

  return {
    get url() {
      return `tcp://${host}:${actualPort}`;
    },
    start() {
      if (server.listening) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          const address = server.address();
          if (address && typeof address !== "string") {
            actualPort = address.port;
          }
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
    },
    stop() {
      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();

      if (!server.listening) return Promise.resolve();
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
    async advance() {
      const hunk = scenario.hunks[emittedHunks];
      if (!hunk) return null;
      emittedHunks += 1;

      const event = createHunkDiffEvent(hunk.utterances);
      if (event.added.length > 0 || event.updated.length > 0) {
        broadcast(event);
      }
      return event;
    },
  };

  function createHunkDiffEvent(
    utterances: GranolaTranscriptUtterance[],
  ): GranolaTranscriptDiffEvent {
    const added: GranolaTranscriptDiffEvent["added"] = [];
    const updated: GranolaTranscriptDiffEvent["updated"] = [];

    for (const utterance of utterances) {
      if (!utterance.id) continue;
      const key = `${scenario.documentId}:${utterance.id}`;
      const previous = transcriptState.get(key);
      if (previous) {
        updated.push({
          key,
          documentId: scenario.documentId,
          utterance,
          previous,
        });
      } else {
        added.push({
          key,
          documentId: scenario.documentId,
          utterance,
        });
        transcriptOrder.push(key);
      }
      transcriptState.set(key, utterance);
    }

    return {
      type: "transcript_diff",
      observedAt: now().toISOString(),
      activeDocumentId: scenario.documentId,
      added,
      updated,
    };
  }

  function createReplayEvent(): GranolaTranscriptDiffEvent | null {
    if (transcriptState.size === 0) return null;

    return {
      type: "transcript_diff",
      observedAt: now().toISOString(),
      activeDocumentId: scenario.documentId,
      added: transcriptOrder.flatMap((key) => {
        const utterance = transcriptState.get(key);
        return utterance
          ? [{ key, documentId: scenario.documentId, utterance }]
          : [];
      }),
      updated: [],
    };
  }

  function broadcast(event: GranolaTranscriptDiffEvent) {
    for (const socket of sockets) {
      writeEvent(socket, event);
    }
  }
}

function createWatchStartedEvent(
  scenario: SimulationScenario,
): GranolaWatchStartedEvent {
  return {
    type: "watch_started",
    granolaDir: `simulation://${scenario.documentId}`,
    intervalMs: 0,
    transcriptDocuments: 1,
    activeDocumentId: scenario.documentId,
  };
}

function writeEvent(socket: net.Socket, event: Parameters<typeof encodeSimulationEvent>[0]) {
  socket.write(encodeSimulationEvent(event));
}
