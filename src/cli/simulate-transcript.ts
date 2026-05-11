#!/usr/bin/env node
import fs from "node:fs/promises";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import { Command, CommanderError, Option } from "commander";

import { DEFAULT_SIMULATION_URL } from "./app-args.js";
import { isMain } from "./is-main.js";
import { normalizeScriptArgv } from "./argv.js";
import { parseTcpUrl } from "../simulation/protocol.js";
import { parseSimulationScenario } from "../simulation/scenario.js";
import { createSimulationTranscriptServer } from "../simulation/server.js";

interface SimulateArgs {
  scenario: string;
  url: string;
  help: boolean;
}

const DEFAULT_SCENARIO_PATH = fileURLToPath(
  new URL("../../fixtures/simulation/technical-interview.md", import.meta.url),
);

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseSimulateArgs(normalizeScriptArgv(argv));
  if (args.help) {
    console.log(getSimulateHelp());
    return;
  }

  const scenarioMarkdown = await fs.readFile(args.scenario, "utf8");
  const scenario = parseSimulationScenario(scenarioMarkdown);
  const address = parseTcpUrl(args.url);
  const server = createSimulationTranscriptServer({
    scenario,
    host: address.host,
    port: address.port,
  });

  await server.start();
  console.log(`Simulation transcript sidecar listening on ${server.url}`);
  console.log(`Scenario: ${scenario.title}`);
  console.log("Press Enter or n for the next hunk. Press q or Ctrl+C to quit.");

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on("keypress", async (_input, key) => {
    if (key?.ctrl && key.name === "c") {
      await shutdown(server);
      return;
    }
    if (key?.name === "q") {
      await shutdown(server);
      return;
    }
    if (key?.name !== "return" && key?.name !== "n") return;

    const event = await server.advance();
    if (!event) {
      console.log("No more transcript hunks.");
      return;
    }
    console.log(
      `Emitted ${event.added.length + event.updated.length} utterance event(s).`,
    );
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
    scenario: string;
    url: string;
    help?: boolean;
  }>();

  return {
    scenario: options.scenario,
    url: options.url,
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
    .addOption(
      new Option("--scenario <path>", "Markdown transcript scenario").default(
        DEFAULT_SCENARIO_PATH,
        "bundled demo",
      ),
    )
    .option("--url <tcp-url>", "TCP URL to listen on", DEFAULT_SIMULATION_URL)
    .option("--help", "Show this help", false);
}

async function shutdown(server: { stop: () => Promise<void> }) {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  await server.stop();
  process.exit(0);
}

if (isMain(import.meta.url, process.argv, "simulate-transcript")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
