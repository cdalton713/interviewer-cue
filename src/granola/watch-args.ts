import { Command, CommanderError, InvalidArgumentError } from "commander";

import { parseDecryptArgs } from "./cache-cli.js";
import type { WatchArgs } from "./types.js";

export function getWatchHelp(): string {
  return `${createWatchCommand().helpInformation()}
Granola cache options:
  --summary                 Print cache/transcript counts only (default)
  --json                    Print decrypted cache JSON
  --transcript <documentId> Print one document transcript JSON
  --granola-dir <path>      Override Granola data directory
  --keychain-service <name> Override safeStorage keychain service
  --keychain-account <name> Override safeStorage keychain account
  --help                    Show this help
`;
}

export function parseWatchArgs(
  argv: string[],
  defaultGranolaDir: string,
): WatchArgs {
  const program = createWatchCommand();

  try {
    program.parse(argv, { from: "user" });
  } catch (error) {
    throw normalizeCommanderError(error);
  }

  const options = program.opts<{
    intervalMs: number;
    emitExisting?: boolean;
  }>();
  const passthrough = stripWatchArgs(argv);

  return {
    ...parseDecryptArgs(passthrough, defaultGranolaDir),
    intervalMs: options.intervalMs,
    emitExisting: options.emitExisting === true,
  };
}

function parseIntervalMs(value: string): number {
  const intervalMs = Number(value);
  if (!Number.isFinite(intervalMs) || intervalMs < 250) {
    throw new InvalidArgumentError("--interval-ms must be a number >= 250");
  }
  return intervalMs;
}

function createWatchCommand(): Command {
  return new Command("granola-watch-cache")
    .exitOverride()
    .configureOutput({
      writeErr: () => {},
      writeOut: () => {},
    })
    .helpOption(false)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .option("--interval-ms <ms>", "Poll interval in milliseconds", parseIntervalMs, 2000)
    .option("--emit-existing", "Emit existing transcript entries on startup", false);
}

function stripWatchArgs(argv: string[]): string[] {
  const passthrough: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--interval-ms") {
      index += 1;
      continue;
    }
    if (arg?.startsWith("--interval-ms=")) {
      continue;
    }
    if (arg === "--emit-existing") {
      continue;
    }
    if (arg !== undefined) {
      passthrough.push(arg);
    }
  }
  return passthrough;
}

function normalizeCommanderError(error: unknown): Error {
  if (error instanceof CommanderError) {
    return new Error(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
