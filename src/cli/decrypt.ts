#!/usr/bin/env node
import os from "node:os";
import path from "node:path";

import { parseDecryptArgs, printHelp, summarizeCache } from "../granola/cache-cli.js";
import { readDecryptedCache } from "../granola/cache-reader.js";
import { normalizeScriptArgv } from "./argv.js";
import { isMain } from "./is-main.js";

const DEFAULT_GRANOLA_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Granola",
);

export function main(argv = process.argv.slice(2)): void {
  const args = parseDecryptArgs(normalizeScriptArgv(argv), DEFAULT_GRANOLA_DIR);
  if (args.help) {
    printHelp();
    return;
  }

  const cacheFile = readDecryptedCache(args);
  if (args.json) {
    console.log(JSON.stringify(cacheFile, null, 2));
    return;
  }
  if (args.transcriptDocumentId) {
    const transcript =
      cacheFile.cache?.state?.transcripts?.[args.transcriptDocumentId] ?? [];
    console.log(JSON.stringify(transcript, null, 2));
    return;
  }

  console.log(JSON.stringify(summarizeCache(cacheFile), null, 2));
}

if (isMain(import.meta.url, process.argv, "decrypt")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
