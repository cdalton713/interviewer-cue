import type {
  GranolaTranscriptDiffEvent,
  GranolaWatchingEvent,
  GranolaWatchErrorEvent,
  GranolaWatchStartedEvent,
} from "../granola/event-source.js";

export type SimulationProtocolEvent =
  | GranolaWatchStartedEvent
  | GranolaTranscriptDiffEvent
  | GranolaWatchErrorEvent
  | GranolaWatchingEvent;

export interface TcpAddress {
  host: string;
  port: number;
}

export function parseTcpUrl(value: string): TcpAddress {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid TCP URL: ${value}`);
  }

  if (url.protocol !== "tcp:") {
    throw new Error(`Invalid TCP URL protocol: ${value}`);
  }

  const port = Number(url.port);
  if (!url.hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid TCP URL host or port: ${value}`);
  }

  return {
    host: url.hostname,
    port,
  };
}

export function encodeSimulationEvent(event: SimulationProtocolEvent): string {
  return `${JSON.stringify(event)}\n`;
}
