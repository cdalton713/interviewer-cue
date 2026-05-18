#!/usr/bin/env node
import os from "node:os";
import path from "node:path";

import React from "react";
import { render } from "ink";

import { getAppHelp, parseAppArgs } from "./cli/app-args.js";
import { createDefaultAppWatchArgs } from "./cli/app-watch-args.js";
import { isMain } from "./cli/is-main.js";
import { normalizeScriptArgv } from "./cli/argv.js";
import { installTerminalLifecycle } from "./cli/terminal-lifecycle.js";
import {
  generateLiveQuestions,
  generateResumeQuestions,
} from "./ai/questions.js";
import { createGranolaEventSource } from "./granola/event-source.js";
import { createFileAppLogger } from "./logging/app-log.js";
import { createSimulationClientEventSource } from "./simulation/client-event-source.js";
import { ChatApp } from "./ui/ChatApp.js";

const DEFAULT_GRANOLA_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Granola",
);

export function runApp(argv = process.argv.slice(2)): void {
  const appArgs = parseAppArgs(normalizeScriptArgv(argv));
  if (appArgs.help) {
    console.log(getAppHelp());
    return;
  }

  installTerminalLifecycle();
  const logger = createFileAppLogger();

  render(
    <ChatApp
      modelId={appArgs.modelId}
      pdfModelId={appArgs.pdfModelId}
      liveModelId={appArgs.liveModelId}
      resumePath={appArgs.resumePath}
      initialInterviewTypeId={appArgs.interviewTypeId}
      logger={logger}
      generateResumeQuestions={(input) =>
        generateResumeQuestions(input, { logger })
      }
      generateLiveQuestions={(input) => generateLiveQuestions(input, { logger })}
      createEventSource={(callbacks) =>
        appArgs.transcriptSource === "simulation"
          ? createSimulationClientEventSource(appArgs.simulationUrl, callbacks)
          : createGranolaEventSource(
              createDefaultAppWatchArgs(DEFAULT_GRANOLA_DIR),
              callbacks,
            )
      }
    />,
  );
}

if (isMain(import.meta.url, process.argv, "app")) {
  runApp();
}
