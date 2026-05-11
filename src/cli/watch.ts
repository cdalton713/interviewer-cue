#!/usr/bin/env node
import os from "node:os";
import path from "node:path";

import { getWatchHelp, parseWatchArgs } from "../granola/watch-args.js";
import { runWatch } from "../granola/watch-runner.js";
import { normalizeScriptArgv } from "./argv.js";

const DEFAULT_GRANOLA_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Granola",
);

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseWatchArgs(normalizeScriptArgv(argv), DEFAULT_GRANOLA_DIR);
  if (args.help) {
    console.log(getWatchHelp());
    return;
  }
  await runWatch(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
