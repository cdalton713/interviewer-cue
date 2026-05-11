import net from "node:net";

import type {
  GranolaEventSource,
  GranolaEventSourceCallbacks,
} from "../granola/event-source.js";
import { parseTcpUrl, type SimulationProtocolEvent } from "./protocol.js";

export function createSimulationClientEventSource(
  simulationUrl: string,
  callbacks: GranolaEventSourceCallbacks,
): GranolaEventSource {
  let socket: net.Socket | null = null;
  let buffer = "";
  let running = false;

  return {
    start() {
      if (running) return;
      running = true;

      const address = parseTcpUrl(simulationUrl);
      socket = net.createConnection(address);
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => {
        buffer += chunk;
        processBufferedLines();
      });
      socket.on("error", (error) => {
        callbacks.error?.({
          type: "watch_error",
          message: error.message,
        });
      });
      socket.on("close", () => {
        socket = null;
      });
    },
    stop() {
      running = false;
      buffer = "";
      socket?.destroy();
      socket = null;
    },
  };

  function processBufferedLines() {
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) processLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  function processLine(line: string) {
    let event: SimulationProtocolEvent;
    try {
      event = JSON.parse(line) as SimulationProtocolEvent;
    } catch (error) {
      callbacks.error?.({
        type: "watch_error",
        message: `Malformed simulation event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return;
    }

    switch (event.type) {
      case "watch_started":
        callbacks.started?.(event);
        break;
      case "transcript_diff":
        callbacks.transcriptDiff?.(event);
        break;
      case "watch_error":
        callbacks.error?.(event);
        break;
      case "watching":
        callbacks.watching?.(event);
        break;
      default:
        callbacks.error?.({
          type: "watch_error",
          message: `Unsupported simulation event type: ${String(
            (event as { type?: unknown }).type,
          )}`,
        });
    }
  }
}
