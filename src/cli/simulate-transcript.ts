#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

import { Command, CommanderError, Option } from "commander";

import { DEFAULT_SIMULATION_URL } from "./app-args.js";
import { isMain } from "./is-main.js";
import { normalizeScriptArgv } from "./argv.js";
import { readDecryptedCache } from "../granola/cache-reader.js";
import { parseTcpUrl } from "../simulation/protocol.js";
import {
  createGranolaReplayScenario,
  listRecentGranolaTranscriptDocuments,
  type RecentGranolaTranscriptDocument,
} from "../simulation/granola-replay.js";
import { createSimulationTranscriptServer } from "../simulation/server.js";

export interface SimulateArgs {
  granolaDir: string;
  transcriptDocumentId: string | null;
  stepSeconds: number;
  url: string;
  keychainService: string;
  keychainAccount: string;
  help: boolean;
}

export interface SimulationReplayControlsInput {
  isTTY?: boolean;
  setRawMode?: (enabled: boolean) => void;
  resume?: () => unknown;
  on(event: "keypress", listener: (input: string, key?: { ctrl?: boolean; name?: string }) => void): unknown;
}

export interface SimulationReplayControlsServer {
  advance(): Promise<{ added: unknown[]; updated: unknown[] } | null>;
  stop(): Promise<void>;
}

const DEFAULT_GRANOLA_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Granola",
);
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_RECENT_TRANSCRIPT_LIMIT = 10;

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseSimulateArgs(normalizeScriptArgv(argv));
  if (args.help) {
    console.log(getSimulateHelp());
    return;
  }

  const cacheFile = readDecryptedCache({
    granolaDir: args.granolaDir,
    json: false,
    summary: true,
    transcriptDocumentId: args.transcriptDocumentId,
    keychainService: args.keychainService,
    keychainAccount: args.keychainAccount,
    help: false,
  });
  const transcriptDocumentId =
    args.transcriptDocumentId ?? (await selectGranolaTranscriptDocument(cacheFile));
  const scenario = createGranolaReplayScenario(cacheFile, {
    documentId: transcriptDocumentId,
    stepSeconds: args.stepSeconds,
  });
  const address = parseTcpUrl(args.url);
  const server = createSimulationTranscriptServer({
    scenario,
    host: address.host,
    port: address.port,
  });

  await server.start();
  console.log(`Simulation transcript sidecar listening on ${server.url}`);
  console.log(`Granola transcript: ${scenario.documentId}`);
  console.log(`Replay step: ${args.stepSeconds}s`);
  console.log("Press Enter or n for the next transcript-time step. Press q or Ctrl+C to quit.");

  bindSimulationReplayControls({
    input: process.stdin,
    server,
    log: console.log,
  });
}

export function parseSimulateArgs(argv: string[]): SimulateArgs {
  const program = createSimulateCommand();
  try {
    program.parse(argv, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      throw new Error(error.message);
    }
    throw error;
  }

  const options = program.opts<{
    granolaDir: string;
    transcript?: string;
    stepSeconds: string;
    url: string;
    keychainService: string;
    keychainAccount: string;
    help?: boolean;
  }>();
  const stepSeconds = parsePositiveIntegerOption(
    options.stepSeconds,
    "--step-seconds",
  );

  return {
    granolaDir: options.granolaDir,
    transcriptDocumentId: options.transcript ?? null,
    stepSeconds,
    url: options.url,
    keychainService: options.keychainService,
    keychainAccount: options.keychainAccount,
    help: options.help === true,
  };
}

export function getSimulateHelp(): string {
  return createSimulateCommand().helpInformation();
}

function createSimulateCommand(): Command {
  return new Command("interviewer-cue simulate-transcript")
    .exitOverride()
    .configureOutput({
      writeErr: () => {},
      writeOut: () => {},
    })
    .helpOption(false)
    .option("--granola-dir <path>", "Override Granola data directory", DEFAULT_GRANOLA_DIR)
    .option("--transcript <documentId>", "Replay one Granola transcript document")
    .addOption(
      new Option(
        "--step-seconds <seconds>",
        "Transcript-time interval emitted on each step",
      ).default(String(DEFAULT_STEP_SECONDS)),
    )
    .option("--url <tcp-url>", "TCP URL to listen on", DEFAULT_SIMULATION_URL)
    .option(
      "--keychain-service <name>",
      "Override safeStorage keychain service",
      "Granola Safe Storage",
    )
    .option(
      "--keychain-account <name>",
      "Override safeStorage keychain account",
      "Granola Key",
    )
    .option("--help", "Show this help", false);
}

async function selectGranolaTranscriptDocument(
  cacheFile: Parameters<typeof createGranolaReplayScenario>[0],
): Promise<string | null> {
  const recent = listRecentGranolaTranscriptDocuments(cacheFile, {
    limit: DEFAULT_RECENT_TRANSCRIPT_LIMIT,
  });
  if (recent.length === 0) return null;
  if (!process.stdin.isTTY) return recent[0]?.documentId ?? null;

  console.log("Recent Granola transcripts:");
  recent.forEach((document, index) => {
    console.log(formatRecentTranscriptOption(index, document));
  });

  const answer = await askQuestion(
    `Choose transcript [1-${recent.length}, default 1]: `,
  );
  const selectedIndex = answer.trim() === "" ? 0 : Number(answer.trim()) - 1;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= recent.length) {
    throw new Error(`Invalid transcript selection: ${answer}`);
  }

  return recent[selectedIndex]?.documentId ?? null;
}

function formatRecentTranscriptOption(
  index: number,
  document: RecentGranolaTranscriptDocument,
): string {
  const timestamp = document.latestTimestamp ? ` latest ${document.latestTimestamp}` : "";
  const source = document.latestSource ? ` ${document.latestSource}` : "";
  const preview = document.latestTextPreview ? ` - ${document.latestTextPreview}` : "";
  return `${index + 1}. ${document.documentId} (${document.utterances} utterances${timestamp})${source}${preview}`;
}

function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function parsePositiveIntegerOption(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a number >= 1`);
  }
  return parsed;
}

export function bindSimulationReplayControls({
  input,
  server,
  log,
  exit = process.exit,
}: {
  input: SimulationReplayControlsInput;
  server: SimulationReplayControlsServer;
  log: (message: string) => void;
  exit?: (code?: number) => never;
}): void {
  readline.emitKeypressEvents(input as NodeJS.ReadStream);
  if (input.isTTY) {
    input.setRawMode?.(true);
    input.resume?.();
  }

  input.on("keypress", async (_input, key) => {
    if (key?.ctrl && key.name === "c") {
      await shutdown({ input, server, exit });
      return;
    }
    if (key?.name === "q") {
      await shutdown({ input, server, exit });
      return;
    }
    if (key?.name !== "return" && key?.name !== "n") return;

    const event = await server.advance();
    if (!event) {
      log("No more transcript hunks.");
      return;
    }
    log(`Emitted ${event.added.length + event.updated.length} utterance event(s).`);
  });
}

async function shutdown({
  input,
  server,
  exit,
}: {
  input: SimulationReplayControlsInput;
  server: { stop: () => Promise<void> };
  exit: (code?: number) => never;
}) {
  if (input.isTTY) {
    input.setRawMode?.(false);
  }
  await server.stop();
  exit(0);
}

if (isMain(import.meta.url, process.argv, "simulate-transcript")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
