export type ConsoleStatus = "watching" | "error";

export interface TranscriptConsoleEvent {
  type: "transcript";
  id: string;
  documentId: string;
  utteranceId: string;
  text: string;
  speaker?: string;
  observedAt: string;
  startTimestamp?: string;
  endTimestamp?: string;
  isFinal?: boolean;
}

export interface SystemConsoleEvent {
  type: "system";
  id: string;
  message: string;
}

export interface ErrorConsoleEvent {
  type: "error";
  id: string;
  message: string;
}

export type ConsoleEvent =
  | TranscriptConsoleEvent
  | SystemConsoleEvent
  | ErrorConsoleEvent;
