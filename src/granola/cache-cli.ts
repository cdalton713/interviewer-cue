import { Command, CommanderError } from "commander";

import type { DecryptArgs, GranolaCacheFile } from "./types.js";

export interface CacheSummary {
  cacheVersion: number | undefined;
  documents: number;
  sharedDocuments: number;
  transcriptDocuments: number;
  utterances: number;
  interimUtterances: number;
  latest: Array<{
    documentId: string;
    utteranceId: string | undefined;
    timestamp: string | undefined;
    source: string | undefined;
    isFinal: boolean | undefined;
    textLength: number;
  }>;
}

export function parseDecryptArgs(
  argv: string[],
  defaultGranolaDir: string,
): DecryptArgs {
  const program = createDecryptCommand(defaultGranolaDir);
  const help = argv.includes("--help") || argv.includes("-h");
  if (help) {
    return {
      granolaDir: defaultGranolaDir,
      json: false,
      summary: true,
      transcriptDocumentId: null,
      keychainService: "Granola Safe Storage",
      keychainAccount: "Granola Key",
      help: true,
    };
  }

  try {
    program.parse(argv, { from: "user" });
  } catch (error) {
    throw normalizeCommanderError(error);
  }

  const options = program.opts<{
    granolaDir: string;
    json?: boolean;
    summary?: boolean;
    transcript?: string;
    keychainService: string;
    keychainAccount: string;
  }>();

  return {
    granolaDir: options.granolaDir,
    json: options.json === true,
    summary: options.transcript ? false : options.json === true ? false : true,
    transcriptDocumentId: options.transcript ?? null,
    keychainService: options.keychainService,
    keychainAccount: options.keychainAccount,
    help,
  };
}

export function getDecryptHelp(): string {
  return createDecryptCommand("<granola-dir>").helpInformation();
}

export function printHelp(): void {
  console.log(getDecryptHelp());
}

export function summarizeCache(cacheFile: GranolaCacheFile): CacheSummary {
  const state = cacheFile.cache?.state;
  if (!state) {
    throw new Error("Decrypted cache did not contain cache.state");
  }

  const transcripts = state.transcripts ?? {};
  const documents = state.documents ?? {};
  const sharedDocuments = state.sharedDocuments ?? {};
  const transcriptEntries = Object.entries(transcripts);
  const utterances = transcriptEntries.flatMap(([documentId, chunks]) =>
    Array.isArray(chunks) ? chunks.map((chunk) => ({ documentId, chunk })) : [],
  );
  const latest = utterances
    .filter(({ chunk }) => chunk.end_timestamp || chunk.start_timestamp)
    .sort((a, b) =>
      String(
        b.chunk.end_timestamp ?? b.chunk.start_timestamp,
      ).localeCompare(String(a.chunk.end_timestamp ?? a.chunk.start_timestamp)),
    )
    .slice(0, 10)
    .map(({ documentId, chunk }) => ({
      documentId,
      utteranceId: chunk.id,
      timestamp: chunk.end_timestamp ?? chunk.start_timestamp,
      source: chunk.source,
      isFinal: chunk.is_final,
      textLength: typeof chunk.text === "string" ? chunk.text.length : 0,
    }));

  return {
    cacheVersion: cacheFile.cache?.version,
    documents: Object.keys(documents).length,
    sharedDocuments: Object.keys(sharedDocuments).length,
    transcriptDocuments: transcriptEntries.length,
    utterances: utterances.length,
    interimUtterances: utterances.filter(({ chunk }) => chunk.is_final === false)
      .length,
    latest,
  };
}

function createDecryptCommand(defaultGranolaDir: string): Command {
  return new Command("granola-decrypt-cache")
    .exitOverride()
    .configureOutput({
      writeErr: () => {},
      writeOut: () => {},
    })
    .allowExcessArguments(false)
    .helpOption("-h, --help", "Show this help")
    .option("--summary", "Print cache/transcript counts only (default)")
    .option("--json", "Print decrypted cache JSON")
    .option("--transcript <documentId>", "Print one document transcript JSON")
    .option("--granola-dir <path>", "Override Granola data directory", defaultGranolaDir)
    .option(
      "--keychain-service <name>",
      "Override safeStorage keychain service",
      "Granola Safe Storage",
    )
    .option(
      "--keychain-account <name>",
      "Override safeStorage keychain account",
      "Granola Key",
    );
}

function normalizeCommanderError(error: unknown): Error {
  if (error instanceof CommanderError) {
    return new Error(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
