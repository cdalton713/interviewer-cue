import { Command, CommanderError } from "commander";

import { DEFAULT_MODEL_ID, parseModelId } from "../ai/provider-registry.js";

export type TranscriptSource = "granola" | "simulation";

export const DEFAULT_SIMULATION_URL = "tcp://127.0.0.1:4767";

export interface AppArgs {
  modelId?: string;
  pdfModelId?: string;
  liveModelId?: string;
  resumePath?: string;
  interviewTypeId?: string;
  transcriptSource: TranscriptSource;
  simulationUrl: string;
  help: boolean;
}

export function parseAppArgs(argv: string[]): AppArgs {
  const program = createAppCommand();

  try {
    program.parse(argv, { from: "user" });
  } catch (error) {
    throw normalizeCommanderError(error);
  }

  const options = program.opts<{
    model: string;
    pdfModel?: string;
    liveModel?: string;
    resume?: string;
    interviewType?: string;
    transcriptSource: string;
    simulationUrl: string;
    help?: boolean;
  }>();

  const modelId = argvHasModelOption(argv) ? options.model : undefined;
  if (modelId) parseModelId(modelId);
  if (options.pdfModel) parseModelId(options.pdfModel);
  if (options.liveModel) parseModelId(options.liveModel);
  const transcriptSource = parseTranscriptSource(options.transcriptSource);

  return {
    modelId,
    pdfModelId: options.pdfModel,
    liveModelId: options.liveModel,
    resumePath: options.resume,
    interviewTypeId: options.interviewType,
    transcriptSource,
    simulationUrl: options.simulationUrl,
    help: options.help === true,
  };
}

export function getAppHelp(): string {
  return createAppCommand().helpInformation();
}

function createAppCommand(): Command {
  return new Command("interviewer-cue")
    .exitOverride()
    .configureOutput({
      writeErr: () => {},
      writeOut: () => {},
    })
    .helpOption(false)
    .option("--model <provider:model>", "AI model id", DEFAULT_MODEL_ID)
    .option("--pdf-model <provider:model>", "PDF question AI model id")
    .option("--live-model <provider:model>", "Live question AI model id")
    .option("--resume <path>", "Resume PDF path")
    .option("--interview-type <id>", "Template id to select")
    .option(
      "--transcript-source <granola|simulation>",
      "Transcript event source",
      "granola",
    )
    .option(
      "--simulation-url <tcp-url>",
      "Simulation sidecar TCP URL",
      DEFAULT_SIMULATION_URL,
    )
    .option("--help", "Show this help", false);
}

function parseTranscriptSource(value: string): TranscriptSource {
  if (value === "granola" || value === "simulation") return value;
  throw new Error(`Invalid transcript source: ${value}`);
}

function argvHasModelOption(argv: string[]): boolean {
  return argv.some((arg) => arg === "--model" || arg.startsWith("--model="));
}

function normalizeCommanderError(error: unknown): Error {
  if (error instanceof CommanderError) {
    return new Error(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
