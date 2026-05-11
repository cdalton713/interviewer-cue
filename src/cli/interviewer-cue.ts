#!/usr/bin/env node
import { main as decryptCache } from "./decrypt.js";
import { getInterviewerCueHelp, parseInterviewerCueArgs } from "./interviewer-cue-args.js";
import { isMain } from "./is-main.js";
import { PACKAGE_VERSION } from "./package-info.js";
import { main as simulateTranscript } from "./simulate-transcript.js";
import {
  runUpdateCheck,
  shouldSkipUpdateCheck,
  type UpdateCheckDeps,
  type UpdateCheckResult,
} from "./update-check.js";
import { main as watchCache } from "./watch.js";
import { runApp } from "../app.js";

export interface InterviewerCueDeps {
  runApp: (argv: string[]) => void;
  decryptCache: (argv: string[]) => void;
  watchCache: (argv: string[]) => Promise<void> | void;
  simulateTranscript: (argv: string[]) => Promise<void> | void;
  updateCheck: (deps: UpdateCheckDeps) => Promise<UpdateCheckResult>;
  env: NodeJS.ProcessEnv | Record<string, string | undefined>;
  output: Pick<typeof console, "log" | "error">;
}

export async function runInterviewerCue(
  argv: string[],
  deps: InterviewerCueDeps = defaultDeps(),
): Promise<number> {
  const args = parseInterviewerCueArgs(argv);

  if (args.help) {
    deps.output.log(getInterviewerCueHelp());
    return 0;
  }

  if (args.command === "granolaDecryptCache") {
    deps.decryptCache(args.args);
    return 0;
  }
  if (args.command === "granolaWatchCache") {
    await deps.watchCache(args.args);
    return 0;
  }
  if (args.command === "simulate-transcript") {
    await deps.simulateTranscript(args.args);
    return 0;
  }
  if (args.command === "update") {
    const result = await deps.updateCheck({
      currentVersion: PACKAGE_VERSION,
      mode: "manual",
    });
    return result.status === "failed" ? 1 : 0;
  }

  if (
    !args.noUpdateCheck &&
    !shouldSkipUpdateCheck({ argv, env: deps.env })
  ) {
    const result = await deps.updateCheck({
      currentVersion: PACKAGE_VERSION,
      mode: "startup",
    });
    if (result.status === "installed") {
      return 0;
    }
  }

  deps.runApp(args.args);
  return 0;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const exitCode = await runInterviewerCue(argv);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

function defaultDeps(): InterviewerCueDeps {
  return {
    runApp,
    decryptCache,
    watchCache,
    simulateTranscript,
    updateCheck: runUpdateCheck,
    env: process.env,
    output: console,
  };
}

if (isMain(import.meta.url, process.argv, "interviewer-cue")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
