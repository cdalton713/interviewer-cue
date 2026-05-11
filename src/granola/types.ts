export interface GranolaTranscriptUtterance {
  id?: string;
  text?: string;
  source?: string;
  start_timestamp?: string;
  end_timestamp?: string;
  is_final?: boolean;
  [key: string]: unknown;
}

export type GranolaTranscriptState = Record<string, GranolaTranscriptUtterance[]>;

export interface GranolaCacheFile {
  cache?: {
    version?: number;
    state?: {
      documents?: Record<string, unknown>;
      sharedDocuments?: Record<string, unknown>;
      transcripts?: GranolaTranscriptState;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DecryptArgs {
  granolaDir: string;
  json: boolean;
  summary: boolean;
  transcriptDocumentId: string | null;
  keychainService: string;
  keychainAccount: string;
  help: boolean;
}

export interface WatchArgs extends DecryptArgs {
  intervalMs: number;
  changesOnly: boolean;
}
